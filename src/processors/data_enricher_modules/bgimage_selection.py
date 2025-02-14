import os
import sqlite3
import json
import numpy as np
from PIL import Image
import torch
import clip
import cv2
import faiss
from sklearn.cluster import KMeans
from .image_search import search_image
from ...template.color_template import check_in_palette

class ImageSearchSystem:
    """带有缓存和语义检索的图片搜索系统"""
    DEFAULT_TEMPLATES = [
        "a photo of a {}",
        "a picture of a {}",
        "{} in the scene",
        "a cropped photo of the {}",
        "a good photo of a {}",
        "a bright photo of the {}",
        "a dark photo of the {}",
        "a low resolution photo of a {}",
        "a high resolution photo of the {}",
        "a photo of one {}",
    ]
    def __init__(self, 
                 db_path='image_cache.db',
                 index_path='faiss_index.index',
                 clip_model="ViT-B/32",
                 threshold=0.25,
                 device=None):
        """
        初始化图像搜索系统
        
        :param db_path: SQLite数据库路径
        :param index_path: FAISS索引文件路径
        :param clip_model: CLIP模型名称
        :param threshold: 相似度阈值
        :param device: 计算设备（自动检测GPU）
        """
        # 设备配置
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        
        # 系统参数
        self.db_path = db_path
        self.index_path = index_path
        self.threshold = threshold
        self.feature_dim = 512  # CLIP ViT-B/32的固定维度
        
        # 初始化组件
        self._init_clip(clip_model)
        self._init_database()
        self._init_faiss()

    def _init_clip(self, model_name):
        """加载CLIP模型"""
        self.model, self.preprocess = clip.load(model_name, device=self.device)

    def _init_database(self):
        """初始化数据库连接和表结构"""
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute('''CREATE TABLE IF NOT EXISTS image_metadata
                            (id INTEGER PRIMARY KEY,
                             keyword TEXT,
                             image_path TEXT UNIQUE,
                             dominant_colors TEXT,
                             color_histogram TEXT)''')
        self.conn.commit()

    def _init_faiss(self):
        """初始化FAISS索引"""
        if os.path.exists(self.index_path):
            self.index = faiss.read_index(self.index_path)
        else:
            self.index = faiss.IndexFlatIP(self.feature_dim)
            # if self.device == "cuda":
            #     self.index = faiss.index_cpu_to_gpu(
            #         faiss.StandardGpuResources(), 0, self.index)

    def _text_to_feature(self, text, using_template=True):
        """使用CLIP训练模板处理文本"""
        # 应用模板
        if using_template:
            templated_texts = [t.format(text) for t in self.DEFAULT_TEMPLATES]
        else:
            templated_texts = [self.DEFAULT_TEMPLATES[0].format(text)]
        
        # 批量编码
        text_inputs = clip.tokenize(templated_texts).to(self.device)
        with torch.no_grad():
            text_features = self.model.encode_text(text_inputs)
            text_features /= text_features.norm(dim=-1, keepdim=True)
        
        return text_features

    def _image_to_feature(self, image_path):
        """将图像转换为CLIP特征向量"""
        image = self.preprocess(Image.open(image_path)).unsqueeze(0).to(self.device)
        with torch.no_grad():
            image_feature = self.model.encode_image(image)
        return image_feature / image_feature.norm(dim=-1, keepdim=True)

    def _add_image_record(self, image_path, keyword, dominant_colors, color_hist):
        """添加图片记录到数据库并更新索引"""
        try:
            # 插入数据库
            self.cursor.execute('''INSERT INTO image_metadata 
                                (keyword, image_path, dominant_colors, color_histogram)
                                VALUES (?, ?, ?, ?)''',
                             (keyword, image_path, 
                              json.dumps(dominant_colors),
                              json.dumps(color_hist)))
            # record_id = self.cursor.lastrowid
            
            # 更新FAISS索引
            image_feature = self._image_to_feature(image_path)
            self.index.add(
                image_feature.cpu().numpy().astype('float32'),
            )
            faiss.write_index(self.index, self.index_path)
            return True
        except sqlite3.IntegrityError:
            # 忽略重复图片
            return False
    
    def _search(self, text_features, using_template=True):
        top_k = 10
        all_distances = np.zeros((text_features.shape[0], top_k))
        all_indices = np.zeros((text_features.shape[0], top_k), dtype=np.int64)
        if using_template:
            for i in range(text_features.shape[0]):
                text_feature = text_features[i:i+1]
                
                distances, indices = self.index.search(
                    text_feature, top_k)

                all_distances[i] = distances
                all_indices[i] = indices
        else:
            all_distances, all_indices = self.index.search(
                text_feature, top_k)
        
        return all_distances, all_indices
    
        # argmax_index = np.argmax(all_distances)
        # distance = all_distances.flatten()[argmax_index]
        # index = all_indices.flatten()[argmax_index]
        # valid = distance > self.threshold
        # return index, valid
        
    
    def search(self, keyword, chinese_keyword = None, palettes = None, using_template=True):
        """
        执行图片搜索
        
        :param keyword: 搜索关键词
        :param num: 需要返回的结果数量
        :return: 图片路径列表和对应的元数据
        """
        if chinese_keyword is None:
            chinese_keyword = keyword
        palettes = palettes['color_list'] + [palettes['bcg']]
        # #hex to rgb
        palettes = [[int(i[1:3], 16), int(i[3:5], 16), int(i[5:7], 16)] for i in palettes]
        # 文本特征提取
        text_features = self._text_to_feature(keyword, using_template=using_template)
        text_features = text_features.cpu().numpy().astype('float32')
        
        # 检查有效性
        all_distances, all_indices = self._search(text_features, using_template=using_template)
        semantic_valid_mask = all_distances > self.threshold
        semantic_valid_indices = all_indices[semantic_valid_mask]
        # 获取元数据
        results = []
        if len(semantic_valid_indices) > 0:
            index = ', '.join(str(i) for i in semantic_valid_indices.flatten())
            self.cursor.execute(f'SELECT * FROM image_metadata WHERE id IN ({index})')
            semantic_results = [self._format_result(row) for row in self.cursor.fetchall()]
            if palettes:
                for semantic_result in semantic_results:
                    colors = semantic_result['colors']
                    for color in colors:
                        if check_in_palette(color, palettes):
                            results.append(semantic_result)
                            break
            else:
                results = semantic_results
        # 补充爬取新图片
        while len(results) == 0:
            # 认为通过关键词搜索得到的结果一定是语义有效的
            new_images = self._crawl_images(chinese_keyword, num=10)
            semantic_results = new_images
            if palettes:
                for semantic_result in semantic_results:
                    colors = semantic_result['colors']
                    for color in colors:
                        if check_in_palette(color, palettes):
                            results.append(semantic_result)
                            break
                        
            # all_distances, all_indices = self._search(text_features, using_template=using_template)
            # valid_mask = all_distances > self.threshold
            # valid_indices = all_indices[valid_mask]
        return results[0]

    def _format_result(self, db_row):
        """格式化数据库查询结果"""
        return {
            'id': db_row[0],
            'keyword': db_row[1],
            'path': db_row[2],
            'colors': json.loads(db_row[3]),
            'histogram': json.loads(db_row[4])
        }

    def _crawl_images(self, keyword, num=10):
        """图片爬取方法"""
        img_paths = search_image(keyword, num, engine='baidu')
        new_images = []
        for img_path in img_paths:
            try:
                # 颜色分析
                dominant_colors = self._get_dominant_colors(img_path)
                color_hist = self._get_color_histogram(img_path)
                
                # 添加记录
                if self._add_image_record(img_path, keyword, 
                                         dominant_colors, color_hist):
                    new_images.append(self._format_result(
                        (None, keyword, img_path, 
                         json.dumps(dominant_colors), 
                         json.dumps(color_hist))
                    ))
            except Exception as e:
                print(f"Failed to process {img_path}: {e}")
        
        self.conn.commit()
        return new_images

    def close(self):
        """关闭系统并保存状态"""
        faiss.write_index(self.index, self.index_path)
        self.conn.close()

    @staticmethod
    def _get_dominant_colors(image_path, k=3):
        """获取主要颜色（K-means聚类）"""
        image = cv2.imread(image_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pixels = image.reshape(-1, 3)
        kmeans = KMeans(n_clusters=k).fit(pixels)
        dominant_colors = kmeans.cluster_centers_.astype(int).tolist()
        return dominant_colors
    
    @staticmethod
    def _get_color_histogram(image_path, bins=8):
        """获取颜色直方图"""
        image = cv2.imread(image_path)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0], None, [bins], [0, 180])
        return cv2.normalize(hist, hist).flatten().tolist()



# 使用示例
if __name__ == "__main__":
    # 初始化系统
    search_system = ImageSearchSystem(threshold=0.3)
    
    try:
        # 执行搜索
        result = search_system.search("cats")
        
        # 显示结果
        print(result)
            
    finally:
        # 关闭系统
        search_system.close()