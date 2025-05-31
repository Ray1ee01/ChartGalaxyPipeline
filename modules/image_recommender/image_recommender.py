import json
import os
import requests
from typing import Dict, List, Optional
import pandas as pd
import faiss
from logging import getLogger
from utils.model_loader import ModelLoader
logger = getLogger(__name__)

class ImageRecommender:
    def __init__(self, embed_model_path: str = None, resource_path: str = None, data_path: str = None, index_path: str = None, base_url: str = None, api_key: str = None):
        self.index_builder = None
        if embed_model_path and data_path and index_path:
            from .create_index import ImageRecommender as IndexBuilder
            self.index_builder = IndexBuilder(embed_model_path)
            self.index_builder.load_index(index_path, data_path)
        self.model = ModelLoader.get_model(embed_model_path)
        self.base_url = base_url
        self.request_url = self.base_url + '/chat/completions'
        self.api_key = api_key
        self.resource_path = resource_path
        self.normal_icons = os.path.join(resource_path, 'images')
        self.special_icons = os.path.join(resource_path, 'special_icons')
        self.special_icon_index = os.path.join(self.special_icons, 'data.json')
        self.newicon_path = os.path.join(resource_path, 'attribute_icons')
        self.newicon_data_path = os.path.join(self.newicon_path, 'index.json')
        self.newicon_data = json.load(open(self.newicon_data_path))
        self.newicon_faiss = os.path.join(self.newicon_path, 'faiss.index')
        self.newicon_index = faiss.read_index(self.newicon_faiss)
        self.special_categories = ["country", "emotion"]
        
    def create_query_text_for_value(self, input_data: Dict, group_value: str, group_col: str) -> str:
        """Create a text query from input data for finding similar images."""
        # titles = input_data.get("titles", {})
        text_parts = []

        text_parts.append(group_value)
        columns = [col["name"] + " (" + col["description"] + ")" for col in input_data.get("data", {}).get("columns", []) if col["name"] == group_col][0]
        text_parts.append(" in " + columns)

        # if "main_title" in titles:
        #    text_parts.append(titles["main_title"])

        return "; ".join(text_parts)
    

    def create_query_text(self, input_data: Dict) -> str:
        """Create a text query from input data for finding similar images."""
        titles = input_data.get("titles", {})
        data_facts = input_data.get("datafacts", [])
        
        text_parts = []
        
        # Add metadata
        if "main_title" in titles:
            text_parts.append(titles["main_title"])
        if "sub_title" in titles:
            text_parts.append(titles["sub_title"])
        # columns = [col["name"] + " (" + col["description"] + ")" for col in input_data.get("data", {}).get("columns", [])]
        # text_parts.append("Columns: " + ", ".join(columns))

        for fact in data_facts[:1]:
            text_parts.append(f'{fact["subtype"]} {fact["type"]}, {fact["annotation"]}')
            
        return "; ".join(text_parts)

    def select_optimal_icons(self, group_icons: Dict, embeddings: Dict) -> Dict:
        """
        Select optimal icons for each group value maximizing pairwise similarity.
        
        Args:
            group_icons: Dictionary mapping group values to lists of icon candidates
            embeddings: Dictionary mapping image paths to their embeddings
        
        Returns:
            Dictionary mapping group values to selected optimal icons
        """
        from scipy.spatial.distance import cosine
        import numpy as np
        
        selected_icons = {}
        used_images = set()
        
        # Sort group values by number of candidates (ascending)
        sorted_groups = sorted(group_icons.keys(), key=lambda x: len(group_icons[x]))
        
        for group_value in sorted_groups:
            candidates = group_icons[group_value]
            best_score = float('-inf')
            best_candidate = None
            
            for candidate in candidates:
                if candidate['image_path'] in used_images:
                    continue
                    
                # If this is the first selection, just use similarity score
                if not selected_icons:
                    if candidate['similarity_score'] > best_score:
                        best_score = candidate['similarity_score']
                        best_candidate = candidate
                    continue
                
                # Calculate average dissimilarity with previously selected icons
                candidate_embedding = embeddings[candidate['image_path']]
                dissimilarities = []
                for selected in selected_icons.values():
                    selected_embedding = embeddings[selected['image_path']]
                    # Use cosine distance directly as dissimilarity measure
                    dissimilarity = cosine(candidate_embedding, selected_embedding)
                    dissimilarities.append(dissimilarity)
                
                # Combine original similarity score with average dissimilarity
                # Higher dissimilarity is better for diversity
                avg_dissimilarity = np.mean(dissimilarities)
                combined_score = 0.3 * candidate['similarity_score'] + 0.7 * avg_dissimilarity
                
                if combined_score > best_score:
                    best_score = combined_score
                    best_candidate = candidate
            
            if best_candidate:
                selected_icons[group_value] = best_candidate
                used_images.add(best_candidate['image_path'])
        return selected_icons

    def get_semantic_text(self, image_data: Dict) -> str:
        """
        Get semantic text from image data
        """
        semantic_text = ""
        image_content = image_data.get('image_content', '')
        topic = image_data.get('topic', '')
        color_style = image_data.get('color_style', '')
        name = image_data.get('name', '')

        if image_content:
            semantic_text += f"{image_content}"
        if topic:
            semantic_text += f". {topic}"
        if color_style:
            semantic_text += f". {color_style}"
        if name:
            semantic_text += f". {name}"
            
        return semantic_text

    def process_special_icons(self, category: str, unique_values: List) -> Optional[Dict]:
        """
        Process icons for special categories (country, sports)
        
        Args:
            category: Category name (e.g. "country", "sports")
            unique_values: List of unique values to match icons for
            
        Returns:
            Dictionary mapping values to icons, or None if processing fails
        """
        try:
            # Load special icons data
            with open(self.special_icon_index, 'r') as f:
                special_icons = json.load(f)
                
            if category not in special_icons:
                return None
                
            # Randomly select a type
            import random
            available_types = list(special_icons[category].keys())
            if category == "country":
                selected_type = "circle"
            else:
                selected_type = random.choice(available_types)
            icons = special_icons[category][selected_type]
            
            model = self.model
            
            icon_names = [icon["name"] for icon in icons]
            icon_embeddings = model.encode(icon_names)
            
            result = {}
            for value in unique_values:
                # Convert numpy types to Python native types
                value_str = str(value.item() if hasattr(value, 'item') else value)
                value_embedding = model.encode([value_str])[0]
                
                # Calculate similarities
                from scipy.spatial.distance import cosine
                similarities = [1 - cosine(value_embedding, icon_emb) for icon_emb in icon_embeddings]
                best_idx = max(range(len(similarities)), key=lambda i: similarities[i])
                
                result[value_str] = {
                    "image_path": os.path.join(self.special_icons, icons[best_idx]["path"]),
                    "similarity_score": similarities[best_idx]
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing special icons: {str(e)}")
            return None

    def process_normal_icons(self, input_data: Dict, unique_values: List, group_col: str) -> Dict:
        """
        Process icons for normal categories using image search
        
        Args:
            input_data: Input data dictionary
            unique_values: List of unique values to find icons for
            
        Returns:
            Dictionary mapping values to icons
        """
        all_group_icons = {}
        for value in unique_values:
            group_query = self.create_query_text_for_value(input_data, str(value), group_col)
            group_icons = self.index_builder.search(group_query, top_k=20, new_index=self.newicon_index, new_data=self.newicon_data, image_type='icon')

            all_group_icons[str(value)] = [
                {
                    "image_path": img["image_path"],
                    "image_data": img["image_data"],
                    "similarity_score": 1.0 / (1.0 + float(img["distance"]))
                }
                for img in group_icons
            ]
        
        # Get embeddings for all candidate images using the model directly
        all_images = {img["image_path"]: img["image_data"]
                     for group_candidates in all_group_icons.values()
                     for img in group_candidates}
        
        for key in all_images:
            all_images[key] = self.model.encode(self.get_semantic_text(all_images[key]))
        
        # Select optimal icons
        return self.select_optimal_icons(all_group_icons, all_images)
    def post_process_image(self, image_path: str, max_size: int = 768) -> str:
        """
        Post-process the recommended image:
        1. Convert relative path to absolute path
        2. Remove white background that connects to edges while preserving inner fills
        3. Resize to specified resolution
        4. Convert to base64 string
        
        Args:
            image_path: Relative path to the image
            max_size: Maximum dimension for resizing (default: 768)
                
        Returns:
            Base64 encoded string of the processed image
        """
        try:
            from PIL import Image
            import numpy as np
            import base64
            import io
            from scipy.ndimage import label
            
            # Get absolute path
            abs_path = os.path.join(self.normal_icons, image_path)
            if not os.path.exists(abs_path):
                abs_path = os.path.join(self.newicon_path, image_path)
                if not os.path.exists(abs_path):
                    logger.error(f"Image not found: {abs_path}")
                    return ""
        
            # Open and convert image
            img = Image.open(abs_path)
            
            # Resize image while maintaining aspect ratio
            if img.width > max_size or img.height > max_size:
                ratio = min(max_size / img.width, max_size / img.height)
                new_width = int(img.width * ratio)
                new_height = int(img.height * ratio)
                img = img.resize((new_width, new_height), Image.LANCZOS)
            
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Convert to numpy array for processing
            data = np.array(img)
            
            # Create mask for white background (with tolerance)
            white_color = np.array([255, 255, 255])
            tolerance = 30
            color_dists = np.sqrt(np.sum((data[..., :3] - white_color)**2, axis=2))
            bg_mask = color_dists < tolerance
            
            # Find connected components
            labeled, num_components = label(bg_mask)
            
            # Create border mask
            border_mask = np.zeros_like(bg_mask, dtype=bool)
            border_mask[0, :] = border_mask[-1, :] = True
            border_mask[:, 0] = border_mask[:, -1] = True
            
            # Find components that touch the border
            border_components = set(labeled[border_mask & (labeled > 0)])
            
            # Create mask for border-connected white areas
            outer_mask = np.zeros_like(bg_mask, dtype=bool)
            for component in border_components:
                outer_mask = outer_mask | (labeled == component)
            
            # Set alpha to 0 for border-connected white areas
            data[outer_mask, 3] = 0
            
            # Convert back to PIL Image
            processed_img = Image.fromarray(data)
            
            # Convert to base64 string
            buffered = io.BytesIO()
            processed_img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            return f"data:image/png;base64,{img_str}"
            
        except Exception as e:
            logger.error(f"Error processing image {image_path}: {str(e)}")
            return ""

    def identify_categorical_columns(self, columns: List[Dict], input_data: Dict) -> List[Dict]:
        """
        识别所有categorical列，为每个列确定是否应使用图标以及图标类别。
        
        Args:
            columns: 列信息列表
            input_data: 输入数据
            
        Returns:
            列表，包含所有应该使用图标的categorical列信息
        """
        categorical_columns = []
        
        for column in columns:
            if column["data_type"] == "categorical":
                # 检查是否应该使用图标
                result = self._should_use_icons(column["name"], input_data)
                if result:
                    categorical_columns.append(result)
        
        return categorical_columns
    
    def _should_use_icons(self, column_name: str, input_data: Dict) -> Optional[Dict]:
        """
        Determine whether icons should be used for a specific column
        
        Args:
            column_name: Column name
            input_data: Input data
            
        Returns:
            Dictionary containing column name and category, or None if icons should not be used
        """
        if not self.base_url or not self.api_key:
            return None
            
        # Get unique values for the column
        data_rows = input_data.get("data", {}).get("data", [])
        unique_values = list(set([row[column_name] for row in data_rows]))
        titles = input_data.get("metadata", {}).get("titles", {})

        prompt = f"""Please analyze whether icons should be used to distinguish between different groups in this chart.

Chart Context:
Title: {titles.get('main_title', '')}
Subtitle: {titles.get('sub_title', '')}
Column Name: {column_name}
Unique Values: {', '.join(map(str, unique_values[:10]))}{"..." if len(unique_values) > 10 else ""}

Categorize these values into one of the following types:
1. country (use country flags, including historical countries and regions)
2. industry (e.g., tech, finance, healthcare, manufacturing)
3. weather (e.g., sunny, rainy, cloudy, stormy)
4. emotion (e.g., happy, sad, neutral, excited, like, dislike, support, oppose, agree, disagree)
5. transport (e.g., car, plane, train, ship)
6. nature (e.g., animals, plants, landscapes)
7. sports (e.g., football, basketball, tennis)
8. politics (e.g., president, prime minister, king, queen, party, government)
9. other (e.g., food, drink, art, music, science, technology, history, geography, etc.) suitable for icons
10. abstract (not suitable for icons)

Consider whether icons would enhance understanding of the data. If the values don't clearly fit into any specific category above, or if using icons would not add meaningful information, select 'abstract' and set 'use_icons' to false.

Please respond in JSON format:
{{
    "use_icons": true/false,
    "category": "country/industry/weather/emotion/transport/nature/sports/abstract"
}}"""

        try:
            response = requests.post(
                self.request_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{
                        "role": "user",
                        "content": prompt
                    }]
                }
            )
            if response.status_code == 200:
                content = response.json()['choices'][0]['message']['content']
                content = content.replace('```json\n', '').replace('\n```', '').strip()
                try:
                    decision = json.loads(content)
                    logger.info(f"Column {column_name} icon usage decision: {decision}")
                    
                    if not decision['use_icons']:
                        return None
                        
                    return {
                        "column": column_name,
                        "category": decision['category']
                    }
                    
                except json.JSONDecodeError:
                    logger.error("Failed to parse LLM response as JSON")
                    return None
            else:
                logger.error(f"LLM API request failed with status code: {response.status_code}")
                return None
            
        except Exception as e:
            logger.error(f"Error calling LLM API: {str(e)}")
            return None

    def recommend_images(self, input_data: Dict) -> Dict:
        """
        Recommend images based on the input data.
        """
        if self.index_builder is None:
            raise ValueError("Index builder not initialized")
        
        # Extract necessary information
        data_dict = input_data.get("data", {})
        columns = data_dict.get("columns", [])
        
        # Step 1: 识别所有应该使用图标的categorical列
        categorical_columns = self.identify_categorical_columns(columns, input_data)
        # print(categorical_columns)
        
        # Step 2: Get topic-level clipart recommendations
        query_text = self.create_query_text(input_data)
        topic_clipart = self.index_builder.search(query_text, top_k=5, image_type='clipart')
        
        # Prepare the result
        result = {
            "topic_clipart": [
                {
                    "image_path": img["image_path"],
                    "image_data": img["image_data"],
                    "similarity_score": 1.0 / (1.0 + img["distance"])
                }
                for img in topic_clipart
            ],
            "group_icons": {}
        }

        # Step 3: 为每个categorical列处理图标
        for column_info in categorical_columns:
            group_col = column_info["column"]
            category = column_info["category"]
            data_rows = input_data.get("data", {}).get("data", [])
            unique_values = list(set([row[group_col] for row in data_rows]))
            
            # 创建一个包含列名的键，用于存储该列的图标
            column_key = f"{group_col}"
            result["group_icons"][column_key] = {}
            
            # Try special categories first
            if category in self.special_categories:
                icons = self.process_special_icons(category, unique_values)
                if icons:
                    result["group_icons"][column_key] = icons
            else:
                # print(f"Processing normal icons for column {group_col}")
                # 为该列创建专门的输入数据
                column_input = {
                    "data": data_dict,
                    "titles": input_data.get("metadata", {}).get("titles", {})
                }
                icons = self.process_normal_icons(column_input, unique_values, group_col)
                result["group_icons"][column_key] = icons
        
        return self.process_recommendation_result(result)

    def process_recommendation_result(self, result: Dict) -> Dict:
        """
        Process the recommendation result:
        1. Remove unnecessary fields
        2. Convert paths to absolute paths
        3. Post-process images
        4. Random select from lists
        
        Args:
            result: Original recommendation result
            
        Returns:
            Processed recommendation result
        """
        import random
        
        processed = {"other": {}, "field": {}}
        
        # Process topic clipart
        if result["topic_clipart"]:
            # Randomly select one clipart
            clipart = random.choice(result["topic_clipart"])
            processed["other"]["primary"] = self.post_process_image(clipart["image_path"], max_size=768)
        
        # Process group icons - 新结构支持多列的图标
        for column_name, column_icons in result["group_icons"].items():
            key_icon_pairs = {}
            for group, icons in column_icons.items():
                field_key = group
                if isinstance(icons, list):
                    # For normal icons (list of candidates)
                    icon = random.choice(icons)
                    processed["field"][field_key] = self.post_process_image(icon["image_path"], max_size=256)
                    key_icon_pairs[group] = icon
                else:
                    # For special icons (single icon)
                    processed["field"][field_key] = self.post_process_image(icons["image_path"], max_size=256)
                    key_icon_pairs[group] = icons
            # processed["field"] = self.process_stretch_icons(self.input_data, processed["field"], column_name, key_icon_pairs)
        
        return processed

    def process_stretch_icons(self, input_data: Dict, icons: Dict, column_name: str, key_icon_pair: Dict) -> Dict:
        """
        Process stretch icons based on the input data.
        """
        data_rows = input_data.get("data", {}).get("data", [])
        numerical_column = {}
        for column in input_data.get("data", {}).get("columns", []):
            if column["role"] == "y":
                numerical_column = column
                break
        # print(numerical_column)
        if not numerical_column:
            return icons
        data_values = {}
        for key, icon in key_icon_pair.items():
            for row in data_rows:
                if row[column_name] == key:
                    data_values[key] = {
                        "value": row[numerical_column["name"]],
                        "icon": icon
                    }
        # print(data_values)
        # 检查data_values是否是数值
        if not all(isinstance(value["value"], (int, float)) for value in data_values.values()):
            return icons
        
        width = 30
        min_height = 5
        max_height = 300
        min_value = 1e5
        max_value = -1e5
        for key, value in data_values.items():
            if value["value"] < min_value:
                min_value = value["value"]
            if value["value"] > max_value:
                max_value = value["value"]
        height_range = max_value - min_value
        for key, value in data_values.items():
            value["height"] = min(max(min_height, width * value["value"] / height_range), max_height)
            from PIL import Image
            import numpy as np
            import base64
            import io
            # Get absolute path
            abs_path = os.path.join(self.normal_icons, value["icon"]["image_path"])
            if not os.path.exists(abs_path):
                logger.error(f"Image not found: {abs_path}")
                return ""
            
            # Convert white background to transparent
            img = Image.open(abs_path)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            data = np.array(img)
            # Convert white-ish pixels to transparent
            # RGB all > 240 is considered white-ish
            white_mask = (data[..., :3] > 240).all(axis=2)
            data[white_mask, 3] = 0
            
            processed_img = Image.fromarray(data)
            
            # Convert to base64 string
            buffered = io.BytesIO()
            processed_img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            request_data = {
                "image": f"data:image/png;base64,{img_str}",
                "scale": value["height"] / 30,
                'hrz': 'false'
            }
            response = requests.post(
                "http://166.111.86.168:5000/scale",
                json=request_data
            )
            response.raise_for_status()
            result = response.content
            # 解码base64数据并保存图片
            img_data = base64.b64decode(result.split(b"data:image/png;base64,")[1])
            with open(f"./tmp/stretch_icon_{key}.png", "wb") as f:
                f.write(img_data)
            # value["icon"]["image_path"] = result["image_path"]
        return data_values

def scale_icon(icon: Dict, height: float) -> Dict:
    """
    Scale the icon to the given height.
    """
    from PIL import Image
    import numpy as np
    import base64
    import io
    
    # Get absolute path
    abs_path = os.path.join(self.normal_icons, icon["image_path"])
    if not os.path.exists(abs_path):
        logger.error(f"Image not found: {abs_path}")
        return ""

def process(input: str, output: str, embed_model_path: str = None, resource_path: str = None, data_path: str = None, index_path: str = None, base_url: str = None, api_key: str = None) -> bool:
    """
    Pipeline入口函数，处理单个文件的图像推荐
    
    Args:
        input_path: 输入JSON文件路径
        output_path: 输出JSON文件路径
        embed_model_path: 嵌入模型路径
        data_path: 图像数据路径
        index_path: 索引文件路径
    """
    # print("process")
    try:
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
        # print("input")
        # 预处理数据
        processed_data = preprocess_data(data)
        # print("processed_data")
        # 生成图像推荐
        recommender = ImageRecommender(
            embed_model_path=embed_model_path,
            data_path=data_path,
            index_path=index_path,
            resource_path=resource_path,
            base_url=base_url,
            api_key=api_key
        )
        recommender.input_data = processed_data
        image_result = recommender.recommend_images(processed_data)
        # print("image_result")
        # 添加图像推荐到数据中
        processed_data["images"] = image_result
        
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