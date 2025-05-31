import argparse
import os
import sys
import json
import logging
from tqdm import tqdm

# 添加项目根目录到Python路径
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)

# 然后使用相对于项目根目录的导入
from modules.title_generator.title_generator import RagTitleGenerator

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("BuildTitleIndex")

def process(data,
            index_path: str='faiss_infographics.index',
            data_path: str='infographics_data.npy',
            embed_model_path: str='',
            force: bool=False):
    try:
        # 检查索引文件是否存在
        if os.path.exists(index_path) and not force:
            logger.info(f"索引文件 {index_path} 已存在，跳过创建。使用 --force 参数强制重建。")
            return True
            
        logger.info("Initializing RagTitleGenerator...")
        generator = RagTitleGenerator(
            index_path=index_path,
            data_path=data_path,
            embed_model_path=embed_model_path
        )
        
        logger.info("Building FAISS index...")
        generator.build_faiss_index(data)
        logger.info("Index built and saved successfully.")
        return True
    except Exception as e:
        logger.error(f"构建索引失败: {str(e)}")
        return False

def main(force: bool=False):
    parser = argparse.ArgumentParser(description="Build FAISS index for title generation")
    parser.add_argument('--data', type=str, required=True, help='Path to training data JSON file')
    parser.add_argument('--index_path', type=str, default='faiss_infographics.index', help='Path to store FAISS index')
    parser.add_argument('--data_path', type=str, default='infographics_data.npy', help='Path to store embedding + title data')
    parser.add_argument('--embed_model_path', type=str, default='', help='Path to sentence embedding model (optional)')
    parser.add_argument('--force', action='store_true', help='Force rebuild even if index exists')

    args = parser.parse_args()

    process(args.data, args.index_path, args.data_path, args.embed_model_path, force or args.force)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"程序执行失败: {str(e)}")
        sys.exit(1)
