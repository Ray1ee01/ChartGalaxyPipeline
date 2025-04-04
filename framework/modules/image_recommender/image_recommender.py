import json
import os
import requests
from typing import Dict, List, Optional
import pandas as pd
from logging import getLogger
logger = getLogger(__name__)

class ImageRecommender:
    def __init__(self, embed_model_path: str = None, data_path: str = None, index_path: str = None, base_url: str = None, api_key: str = None):
        self.index_builder = None
        if embed_model_path and data_path and index_path:
            from .create_index import ImageRecommender as IndexBuilder
            self.index_builder = IndexBuilder()
            self.index_builder.load_index(index_path, data_path)
        self.base_url = base_url
        self.api_key = api_key

    def get_chart_summary(self, input_data: Dict) -> Dict:
        """
        Use LLM to summarize the chart's topic and extract keywords.
        
        Args:
            input_data: Dictionary containing the input data
            
        Returns:
            Dictionary containing topic summary and keywords
        """
        if not self.base_url or not self.api_key:
            logger.warning("LLM API configuration not provided, skipping chart summary")
            return {"topic": "", "keywords": []}
            
        # Prepare the prompt
        metadata = input_data.get("metadata", {})
        titles = metadata.get("titles", {})
        data_facts = metadata.get("data_facts", [])
        columns = input_data.get("data", {}).get("columns", [])
        
        prompt = f"""Please analyze this chart and provide:
1. A concise topic summary (1-3 words)
2. 3-5 relevant keywords for image search

Chart information:
Title: {titles.get('main_title', '')}
Description: {titles.get('sub_title', '')}
Data facts: {', '.join(data_facts[:3])}
Columns: {', '.join([col['name'] for col in columns])}

Please respond in JSON format:
{{
    "topic": "topic summary here",
    "keywords": ["keyword1", "keyword2", ...]
}}"""

        try:
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gemini-2.0-flash",
                    "messages": [{
                        "role": "user",
                        "content": prompt
                    }]
                }
            )
            
            if response.status_code == 200:
                result = response.json()['choices'][0]['message']['content']
                try:
                    # Try to parse the JSON response
                    summary = json.loads(result)
                    # Print the summary
                    logger.info(f"Chart topic: {summary['topic']}")
                    logger.info(f"Keywords: {', '.join(summary['keywords'])}")
                    return summary
                except json.JSONDecodeError:
                    # If parsing fails, return a default structure
                    logger.error("Failed to parse LLM response as JSON")
                    return {"topic": "", "keywords": []}
            else:
                logger.error(f"LLM API request failed with status code: {response.status_code}")
                return {"topic": "", "keywords": []}
                
        except Exception as e:
            logger.error(f"Error calling LLM API: {str(e)}")
            return {"topic": "", "keywords": []}

    def determine_by_group(self, columns: List[Dict], combination: str) -> Optional[str]:
        """
        Determine which column to use for grouping based on the combination type.
        
        Args:
            columns: List of column dictionaries containing name and data_type
            combination: Type of combination (e.g., "categorical + numerical")
            
        Returns:
            The column name to use for grouping, or None if no grouping should be used
        """
        column_names = [col["name"] for col in columns]
        
        if combination == "categorical + numerical":
            return column_names[0]
        elif combination == "categorical + numerical + categorical":
            return column_names[2]
        elif combination == "temporal + numerical + categorical":
            return column_names[2]
        elif combination == "temporal + numerical":
            return None  # Skip for temporal + numerical
        elif combination == "categorical + numerical + temporal":
            return column_names[0]
        else:
            return None

    def create_query_text(self, input_data: Dict, group_value: str = None) -> str:
        """Create a text query from input data for finding similar images."""
        # Get chart summary from LLM
        #summary = self.get_chart_summary(input_data)
        
        # Combine LLM summary with original metadata
        titles = input_data.get("titles", {})
        data_facts = input_data.get("datafacts", [])
        
        text_parts = []
        
        # Add LLM-generated topic and keywords
        #if summary["topic"]:
        #    text_parts.append(summary["topic"])
        #text_parts.extend(summary["keywords"])
        
        # If this is a group query, add the group value
        if group_value:
            text_parts.append(group_value)
        
        # Add original metadata as fallback only if we don't have LLM summary
        if "main_title" in titles:
            text_parts.append(titles["main_title"])
        if "sub_title" in titles:
            text_parts.append(titles["sub_title"])
        columns = [col["name"] + " (" + col["description"] + ")" for col in input_data.get("data", {}).get("columns", [])]
        text_parts.append("Columns: " + ", ".join(columns))

        for fact in data_facts[:3]:
            text_parts.append(f'{fact["subtype"]} {fact["type"]}, {fact["annotation"]}')
            
        return "; ".join(text_parts)

    def recommend_images(self, input_data: Dict) -> Dict:
        """
        Recommend images based on the input data.
        
        Args:
            input_data: Dictionary containing the input data
            
        Returns:
            Dictionary containing the recommended images
        """
        if self.index_builder is None:
            raise ValueError("Index builder not initialized. Please provide embed_model_path, data_path, and index_path.")
            
        # Extract necessary information from input_data
        data_dict = input_data.get("data", {})
        data = pd.DataFrame(data_dict.get("data", []))
        columns = data_dict.get("columns", [])
        combination = data_dict.get("type_combination", "")
        
        # Step 1: Determine by_group
        by_group = self.determine_by_group(columns, combination)
        
        # Step 2: Get topic-level clipart recommendations
        query_text = self.create_query_text(input_data)
        logger.info(f"Searching for topic clipart with query: {query_text}")
        topic_clipart = self.index_builder.search(query_text, top_k=5, image_type='clipart')
        
        # Prepare the result
        result = {
            "topic_clipart": [
                {
                    "image_path": img["image_path"],
                    "image_data": img["image_data"],
                    "similarity_score": 1.0 / (1.0 + img["distance"])  # Convert distance to similarity score
                }
                for img in topic_clipart
            ],
            "group_icons": {}
        }
        
        # Step 3: If we have a group column, get icon recommendations for each group
        if by_group:
            unique_values = data[by_group].unique()
            for value in unique_values:
                # Create a query text specific to this group value
                group_query = self.create_query_text(input_data, str(value))
                logger.info(f"Searching for icons for group {value} with query: {group_query}")
                group_icons = self.index_builder.search(group_query, top_k=10, image_type='icon')
                
                result["group_icons"][str(value)] = [
                    {
                        "image_path": img["image_path"],
                        "image_data": img["image_data"],
                        "similarity_score": 1.0 / (1.0 + img["distance"])
                    }
                    for img in group_icons
                ]
        
        return result

def process(input: str, output: str, embed_model_path: str = None, data_path: str = None, index_path: str = None, base_url: str = None, api_key: str = None) -> bool:
    """
    Pipeline入口函数，处理单个文件的图像推荐
    
    Args:
        input_path: 输入JSON文件路径
        output_path: 输出JSON文件路径
        embed_model_path: 嵌入模型路径
        data_path: 图像数据路径
        index_path: 索引文件路径
    """
    try:
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 预处理数据
        processed_data = preprocess_data(data)
        
        # 生成图像推荐
        recommender = ImageRecommender(
            embed_model_path=embed_model_path,
            data_path=data_path,
            index_path=index_path,
            base_url=base_url,
            api_key=api_key
        )
        image_result = recommender.recommend_images(processed_data)
        
        # 添加图像推荐到数据中
        processed_data["image_recommendations"] = image_result
        
        # 保存结果
        with open(output, "w", encoding="utf-8") as f:
            json.dump(processed_data, f, indent=2, ensure_ascii=False)
            
        return True
            
    except Exception as e:
        logger.error(f"图像推荐失败: {str(e)}")
        return False

def preprocess_data(data: Dict) -> Dict:
    """
    预处理数据，确保格式正确
    """
    try:
        # 深拷贝避免修改原始数据
        processed = data.copy()
        
        # 确保metadata字段存在
        if "metadata" not in processed:
            processed["metadata"] = {}
            
        # 确保titles字段存在
        if "titles" not in processed["metadata"]:
            processed["metadata"]["titles"] = {}
            
        # 确保data_facts字段存在
        if "data_facts" not in processed["metadata"]:
            processed["metadata"]["data_facts"] = []
            
        return processed
        
    except Exception as e:
        logger.error(f"数据预处理失败: {str(e)}")
        raise

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Image Recommender")
    parser.add_argument("--input", type=str, required=True, help="Input JSON file path")
    parser.add_argument("--output", type=str, required=True, help="Output JSON file path")
    parser.add_argument("--embed_model_path", type=str, help="Path to the embedding model")
    parser.add_argument("--data_path", type=str, help="Path to the image data file")
    parser.add_argument("--index_path", type=str, help="Path to the index file")
    parser.add_argument("--base_url", type=str, help="Base URL for LLM API")
    parser.add_argument("--api_key", type=str, help="API key for LLM")
    args = parser.parse_args()

    success = process(
        input=args.input,
        output=args.output,
        embed_model_path=args.embed_model_path,
        data_path=args.data_path,
        index_path=args.index_path,
        base_url=args.base_url,
        api_key=args.api_key
    )

    if success:
        print("Processing json successed.")
    else:
        print("Processing json failed.")

if __name__ == "__main__":
    main() 