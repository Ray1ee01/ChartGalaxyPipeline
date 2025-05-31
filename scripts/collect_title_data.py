import json
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("CollectTitleData")

def collect_training_data(input_dir: str, output_file: str) -> None:
    """
    收集标题训练数据
    
    Args:
        input_dir (str): 输入数据目录
        output_file (str): 输出JSON文件路径
    """
    try:
        input_path = Path(input_dir)
        output_path = Path(output_file)
        
        # 确保输出目录存在
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 收集所有数据
        training_data = {}
        
        # 处理目录下的所有JSON文件
        for json_file in input_path.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                # 使用文件名（不含扩展名）作为chart_id
                chart_id = json_file.stem
                
                # 提取所需字段
                training_data[chart_id] = {
                    "metadata": {
                        "title": data.get("metadata", {}).get("title", ""),
                        "description": data.get("metadata", {}).get("description", ""),
                        "main_insight": data.get("metadata", {}).get("main_insight", "")
                    },
                    "chart_type": data.get("chart_type", []),
                    "datafacts": data.get("datafacts", []),
                    "data": data.get("data", {"columns": [], "data": []})
                }
                
            except Exception as e:
                logger.error(f"处理文件 {json_file} 时出错: {str(e)}")
                continue
        
        # 保存整理后的数据
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(training_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"已收集 {len(training_data)} 个图表的数据到 {output_file}")
        
    except Exception as e:
        logger.error(f"收集训练数据失败: {str(e)}")
        raise

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="收集标题生成训练数据")
    parser.add_argument("--input", default="/data/lizhen/input_data/data2",
                      help="输入数据目录")
    parser.add_argument("--output", default="training_data.json",
                      help="输出JSON文件路径")
    
    args = parser.parse_args()
    
    collect_training_data(args.input, args.output) 