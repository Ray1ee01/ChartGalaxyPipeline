import base64
import io
import requests
from PIL import Image as PILImage, ImageDraw
from typing import Tuple
from modules.chart_engine.template.vegalite_py.utils.element_tool.elements import Path
import cv2
import numpy as np
# import clipper

class ImageProcessor:
    def __init__(self):
        pass
    
    @staticmethod
    def url_to_base64(url: str) -> str:
        """将URL图片转换为base64字符串"""
        if url.startswith(('http://', 'https://')):
            # 网络路径
            response = requests.get(url)
            img = PILImage.open(io.BytesIO(response.content))
        else:
            # 本地路径
            img = PILImage.open(url)
        buffered = io.BytesIO()
        img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    # def get_width_and_height(self, url: str) -> Tuple[int, int]:
    #     """获取图片宽高"""
    #     response = requests.get(url)
    #     img = PILImage.open(io.BytesIO(response.content))
    #     return img.size
    @staticmethod
    def get_width_and_height(base64_str: str) -> Tuple[int, int]:
        """获取图片宽高"""
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        return img.size

    def resize(self, base64_str: str, width: int, height: int) -> str:
        """调整图片大小"""
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        resized_img = img.resize((width, height))
        buffered = io.BytesIO()
        resized_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def crop(self, base64_str: str, x: int, y: int, width: int, height: int) -> str:
        """裁剪图片"""
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        cropped_img = img.crop((x, y, x + width, y + height))
        buffered = io.BytesIO()
        cropped_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def apply_alpha(self, base64_str: str, alpha: float) -> str:
        """应用透明度
        alpha: 透明度,0-1
        """
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        img = img.convert('RGBA')
        data = img.getdata()
        new_data = []
        for item in data:
            new_data.append((item[0], item[1], item[2], int(item[3] * alpha)))
        img.putdata(new_data)
        buffered = io.BytesIO()
        img.save(buffered, format='PNG')
        return base64.b64encode(buffered.getvalue()).decode()

    def rotate(self, base64_str: str, degree: int) -> str:
        """旋转图片"""
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        rotated_img = img.rotate(degree, expand=True)
        buffered = io.BytesIO()
        rotated_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def clip_by_path(self, base64_str: str, path: Path) -> str:
        """根据路径裁剪图片"""
        coordinates = path._get_path_coordinates()
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        #把image临时保存到本地
        img.save('temp.png')
        print(img)
        # 创建一个与图片大小相同的空白图像
        mask = PILImage.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        if not path._bounding_box:
            path._bounding_box = path.get_bounding_box()
        # 在裁剪前保持横纵比对path进行缩放,保证能够容纳下path
        scale_factor = min(img.width / path._bounding_box.width, img.height / path._bounding_box.height)
        coordinates = [(x * scale_factor, y * scale_factor) for x, y in coordinates]
        
        # 同时调整path的坐标,通过平移,保证path在图片内部
        min_x = min(coordinates, key=lambda x: x[0])[0]
        min_y = min(coordinates, key=lambda y: y[1])[1]
        max_x = max(coordinates, key=lambda x: x[0])[0]
        max_y = max(coordinates, key=lambda y: y[1])[1]
        # 计算平移量
        translate_x = min_x
        translate_y = min_y
        # 将path的坐标平移到图片内部
        coordinates = [(x - translate_x, y - translate_y) for x, y in coordinates]
        draw.polygon(coordinates, fill=255)
        
        # 将裁剪后的图像与原始图像进行按位与操作
        img = PILImage.composite(img, PILImage.new('RGBA', img.size, (0, 0, 0, 0)), mask)
        # print("image size: ", img.size)
        # 裁剪后的图片需要进行crop，以保证裁剪后的图片与path的bounding box一致
        img = img.crop((0, 0, path._bounding_box.width*scale_factor, path._bounding_box.height*scale_factor))
        # print("image size after crop: ", img.size)
        buffered = io.BytesIO()
        # 明确指定保存格式为PNG，因为我们需要支持透明度
        img.save(buffered, format='PNG')
        return base64.b64encode(buffered.getvalue()).decode()

    def flip(self, base64_str: str, direction: str) -> str:
        """翻转图片,direction可以是'horizontal'或'vertical'"""
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        if direction == 'horizontal':
            flipped_img = img.transpose(PILImage.FLIP_LEFT_RIGHT)
        else:
            flipped_img = img.transpose(PILImage.FLIP_TOP_BOTTOM)
        buffered = io.BytesIO()
        flipped_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()
    
    def crop_by_circle(self, base64_str: str) -> str:
        """裁剪图片为圆形"""
        img = PILImage.open(io.BytesIO(base64.b64decode(base64_str)))
        # 计算最小半径
        radius = min(img.size[0], img.size[1]) // 2
        # 计算圆心坐标
        center_x = img.size[0] // 2
        center_y = img.size[1] // 2
        # 创建圆形遮罩
        mask = PILImage.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((center_x - radius, center_y - radius, 
                     center_x + radius, center_y + radius), fill=255)
        # 应用遮罩
        output = PILImage.new('RGBA', img.size, (0, 0, 0, 0))
        output.paste(img, mask=mask)
        # 保存并返回base64
        buffered = io.BytesIO()
        output.save(buffered, format='PNG')
        return base64.b64encode(buffered.getvalue()).decode()



def segment(base64_str: str, prompt: str="the foreground of the image"):
    url = "http://0.0.0.0:12191/process_image"
    headers = { "Content-Type": "application/json" }
    data = {
        "requests": [
            {
                "image_b64": base64_str,
                "prompt": prompt
            }
        ],
        "threshold": 0.5
    }
    
    # print(data)
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200 and len(response.json()['results'][0]) > 0:
        segmented_b64 = response.json()['results'][0][0] # 只保留第一个结果
        seg_succeed = True
    else:
        segmented_b64 = base64_str # 如果没有结果，保留原图
        seg_succeed = False
    print(response.status_code)
    segmented_img = PILImage.open(io.BytesIO(base64.b64decode(segmented_b64)))
    # 把segmented_img保存到本地
    segmented_img.save('segmented_img.png')
    return segmented_b64, seg_succeed, segmented_img


class ClipProcessor:
    def __init__(self, base64_str: str, path: Path, prompt: str):
        self.original_b64 = base64_str
        self.original_img = PILImage.open(io.BytesIO(base64.b64decode(self.original_b64)))
        
        self.segmented_b64 = None
        self.segmented_img = None
        
        self.path = path
        self.prompt = prompt
        self.seg_succeed = False
        
    def segment(self):
        url = "http://0.0.0.0:12191/process_image"
        headers = { "Content-Type": "application/json" }
        data = {
            "requests": [
                {
                    "image_b64": self.original_b64,
                    "prompt": self.prompt
                }
            ],
            "threshold": 0.5
        }
        
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200 and len(response.json()['results'][0]) > 0:
            self.segmented_b64 = response.json()['results'][0][0] # 只保留第一个结果
            self.seg_succeed = True
        else:
            self.segmented_b64 = self.original_b64 # 如果没有结果，保留原图
            
        self.segmented_img = PILImage.open(io.BytesIO(base64.b64decode(self.segmented_b64)))
        return self.segmented_b64
        
    def find_position_with_template_matching(self):
        # 旧版本的 segment 代码需要用到这个函数
        A_array = cv2.imdecode(np.frombuffer(base64.b64decode(self.original_b64), np.uint8), cv2.IMREAD_UNCHANGED)
        B_array = cv2.imdecode(np.frombuffer(base64.b64decode(self.segmented_b64), np.uint8), cv2.IMREAD_UNCHANGED)
        self.A = A_array
        self.B = B_array
        
        A_array = cv2.cvtColor(A_array, cv2.COLOR_BGR2BGRA)

        _, _, _, alpha_channel = cv2.split(B_array)
        mask = alpha_channel > 0
        B_array = cv2.bitwise_and(B_array, B_array, mask=mask.astype(np.uint8))

        result = cv2.matchTemplate(A_array, B_array, method=cv2.TM_CCOEFF_NORMED)

        # 找到匹配度最高的点（即最大值的位置）
        _, _, _, max_loc = cv2.minMaxLoc(result)

        # 返回最佳匹配位置（B 的左上角在 A 中的左上角位置）
        print(f"max_loc: {max_loc}")
        return max_loc
    
    def create_mask_old(self, position):
        # 旧版本的 segment 代码需要用到这个函数
        height_A, width_A = self.A.shape[:2]
        mask = np.zeros((height_A, width_A), dtype=np.uint8)
        height_B, width_B = self.B.shape[:2]
        
        _, _, _, alpha_channel = cv2.split(self.B)
        B_mask = alpha_channel > 0
        
        x, y = position
        
        for j in range(height_B):
            for i in range(width_B):
                if B_mask[j, i] == 1:  # 只有 B 中非透明的部分才设置为 1
                    if 0 <= x + i < width_A and 0 <= y + j < height_A:
                        mask[y + j, x + i] = 1
        
        return mask
    
    def create_mask(self):
        np_seg_img = np.array(self.segmented_img)
        mask = np_seg_img[:, :, 3] > 0
        mask = np.array(mask, dtype=np.uint8)
        return mask
        
    def clip_old(self) -> str:
        """根据路径裁剪图片"""
        path = self.path
        coordinates = path._get_path_coordinates()
        img = self.original_img
        
        # 创建一个与图片大小相同的空白图像
        mask = PILImage.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        if not path._bounding_box:
            path._bounding_box = path.get_bounding_box()
        # 在裁剪前保持横纵比对path进行缩放,保证能够容纳下path
        scale_factor = min(img.width / path._bounding_box.width, img.height / path._bounding_box.height)
        coordinates = [(x * scale_factor, y * scale_factor) for x, y in coordinates]
        
        # 同时调整path的坐标,通过平移,保证path在图片内部
        min_x = min(coordinates, key=lambda x: x[0])[0]
        min_y = min(coordinates, key=lambda y: y[1])[1]
        max_x = max(coordinates, key=lambda x: x[0])[0]
        max_y = max(coordinates, key=lambda y: y[1])[1]
        # 计算平移量
        translate_x = min_x
        translate_y = min_y
        # 将path的坐标平移到图片内部
        coordinates = [(x - translate_x, y - translate_y) for x, y in coordinates]
        draw.polygon(coordinates, fill=255)
        
        # 将裁剪后的图像与原始图像进行按位与操作
        img = PILImage.composite(img, PILImage.new('RGBA', img.size, (0, 0, 0, 0)), mask)
        print("image size: ", img.size)
        # 裁剪后的图片需要进行crop，以保证裁剪后的图片与path的bounding box一致
        img = img.crop((0, 0, path._bounding_box.width*scale_factor, path._bounding_box.height*scale_factor))
        print("image size after crop: ", img.size)
        buffered = io.BytesIO()
        # 明确指定保存格式为PNG，因为我们需要支持透明度
        img.save(buffered, format='PNG')
        return base64.b64encode(buffered.getvalue()).decode()
        
    def clip_new(self) -> str:
        mask = self.create_mask()
        height, width = mask.shape
        mask = np.array(mask, dtype=np.uint8)
        seg_min_x, seg_min_y, seg_max_x, seg_max_y = self.get_bounding_box(mask)
        # print(f"min_x: {seg_min_x}, min_y: {seg_min_y}, max_x: {seg_max_x}, max_y: {seg_max_y}")
        
        path = self.path
        coords = path._get_path_coordinates()
        coords = np.array(coords)
        if not path._bounding_box:
            path._bounding_box = path.get_bounding_box()
        scale_factor = min((seg_max_x - seg_min_x) / path._bounding_box.width, (seg_max_y - seg_min_y) / path._bounding_box.height)
        coords = coords * scale_factor
        
        min_x = min(coords[:, 0])
        max_x = max(coords[:, 0])
        min_y = min(coords[:, 1])
        max_y = max(coords[:, 1])
        
        # print(f"min_x: {min_x}, min_y: {min_y}, max_x: {max_x}, max_y: {max_y}")
        
        # 初始化：放在 segment 的中心位置
        tx = (seg_min_x + seg_max_x) / 2 - (min_x + max_x) / 2
        ty = (seg_min_y + seg_max_y) / 2 - (min_y + max_y) / 2
        coords = coords + np.array([tx, ty])
        
        init_solution = [1., 0., 0.] # [scale_factor, translate_x, translate_y]
        scale_factor, translate_x, translate_y = self.optimize(mask, coords, init_solution, num_step=200)
        # 顺序：先缩放，再平移
        coords = coords * scale_factor + np.array([translate_x, translate_y])
        
        coords = [(x, y) for x, y in coords]
        empty_img = PILImage.new('L', (width, height), 0)
        draw = ImageDraw.Draw(empty_img)
        draw.polygon(coords, fill=255)
        img = PILImage.composite(self.original_img, PILImage.new('RGBA', (width, height), (0, 0, 0, 0)), empty_img)
        
        min_x = min(coords, key=lambda x: x[0])[0]
        min_y = min(coords, key=lambda y: y[1])[1]
        max_x = max(coords, key=lambda x: x[0])[0]
        max_y = max(coords, key=lambda y: y[1])[1]
        img = img.crop((min_x, min_y, max_x, max_y))
        buffered = io.BytesIO()
        img.save(buffered, format='PNG')
        return base64.b64encode(buffered.getvalue()).decode()
        
    def clip_by_path(self) -> str:
        if not self.seg_succeed: # 如果分割失败，就直接沿用原始的 clip 算法
            return self.clip_old()
        else: # 如果分割成功，用新的优化算法
            return self.clip_new()
        
    @staticmethod
    def get_bounding_box(mask: np.ndarray) -> tuple:
        y_indices, x_indices = np.where(mask == 1)
        x_min = np.min(x_indices)
        x_max = np.max(x_indices)
        y_min = np.min(y_indices)
        y_max = np.max(y_indices)
        return x_min, y_min, x_max, y_max
    
    @staticmethod
    def get_area(coords: np.ndarray) -> float:
        x = coords[:, 0]
        y = coords[:, 1]
        return 0.5 * np.abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
    
    @staticmethod
    def score(mask: np.ndarray, coords: np.ndarray, solution: list[float], area: float, alpha: float, total_masked: float) -> float:
        scale_factor, translate_x, translate_y = solution        
        new_coords = coords * scale_factor + np.array([translate_x, translate_y])
        score = clipper.get_masked_area(mask, new_coords) / total_masked
        return score
        
    def optimize(self, mask: np.ndarray, coords: np.ndarray, solution: list[float], num_step = 100, alpha = 0.5):
        # mask: 1 表示符合的区域，0 表示不符合的区域. shape: [height, width]
        # coords: path 的坐标. shape: [[x0, y0], [x1, y1], ...]
        # solution: 初始解. shape: [scale_factor, translate_x, translate_y]
        # num_step: 迭代次数
        # alpha: 权重
        height, width = mask.shape
        area = self.get_area(coords)
        total_masked = float(np.sum(mask))
        print(f"area: {area}, total_masked: {total_masked}")
        best_score = self.score(mask, coords, solution, area, alpha, total_masked)
        best_solution = solution.copy()
        print(f"init score: {best_score}, solution: {best_solution}")
        num_stucked = 0 # 记录连续多少次没有找到更好的解
        
        # hill climbing
        for i in range(num_step):
            t = 0.5 * (1 - i / num_step)
            neighbor_solutions = [
                [solution[0] * np.random.uniform(1 - t, 1 + t), solution[1], solution[2]],  # scale_factor 变动
                [solution[0], solution[1] + np.random.uniform(-5, 5), solution[2]],       # translate_x 变动
                [solution[0], solution[1], solution[2] + np.random.uniform(-5, 5)],       # translate_y 变动
            ]
            
            best_neighbor_score = best_score
            best_neighbor_solution = best_solution
            
            for neighbor_solution in neighbor_solutions:
                if not clipper.validate(height, width, coords, neighbor_solution):
                    continue
                new_score = self.score(mask, coords, neighbor_solution, area, alpha, total_masked)
                if new_score > best_neighbor_score:
                    best_neighbor_score = new_score
                    best_neighbor_solution = neighbor_solution
                
            if best_neighbor_score > best_score + 0.01:
                num_stucked = 0
            else:
                num_stucked += 1
                if num_stucked > 20:
                    break
                
            # 如果发现更好的解，则更新
            if best_neighbor_score > best_score:
                best_score = best_neighbor_score
                best_solution = best_neighbor_solution
                print(f"step: {i}, score: {best_score}, solution: {best_solution}")
            
            solution = best_solution
            
        return solution