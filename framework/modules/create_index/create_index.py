import os
import argparse
import logging
from pathlib import Path
from importlib import import_module

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("CreateIndex")

def create_index(index_type: str, force: bool = False) -> bool:
    """
    创建指定类型的索引
    
    Args:
        index_type (str): 索引类型，可选值：'title', 'color', 'image'
        force (bool): 是否强制重建索引
    """
    try:
        # 根据索引类型选择对应的模块
        if index_type == 'title':
            module = import_module('modules.title_generator.create_index')
            index_path = Path('faiss_infographics.index')
            data_path = Path('infographics_data.npy')
        elif index_type == 'color':
            module = import_module('modules.color_recommender.create_index')
            index_path = Path('./static/color_palette.index')
            data_path = Path('./static/color_palette.json')
        elif index_type == 'image':
            module = import_module('modules.image_recommender.create_index')
            index_path = Path('image.index')
            data_path = Path('image.json')
        else:
            logger.error(f"不支持的索引类型: {index_type}")
            return False
            
        # 检查索引文件是否存在
        if index_path.exists() and not force:
            logger.info(f"索引文件 {index_path} 已存在，跳过创建。使用 --force 参数强制重建。")
            return True
            
        # 调用对应模块的main函数
        module.main()
        logger.info(f"{index_type} 索引创建成功")
        return True
        
    except Exception as e:
        logger.error(f"创建 {index_type} 索引失败: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="创建索引")
    parser.add_argument("--type", required=True, choices=['title', 'color', 'image'],
                      help="要创建的索引类型")
    parser.add_argument("--force", action='store_true',
                      help="强制重建索引，即使已存在")
    
    args = parser.parse_args()
    
    success = create_index(args.type, args.force)
    if success:
        print("索引创建成功")
    else:
        print("索引创建失败")
        exit(1)

if __name__ == "__main__":
    main() 