import os
import sys
import json
import numpy as np
import faiss
from tqdm import tqdm
from utils.model_loader import ModelLoader

# Add the project root directory to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(project_root)

from typing import Optional, List, Dict, Union

class ImageRecommender:
    def __init__(self, embed_model_path: str):
        self.model = ModelLoader.get_model(embed_model_path)
        self.index = None
        self.image_paths = []
        self.image_data = []
        self.icon_indices = []  # Store indices of icon images
        self.clipart_indices = []  # Store indices of clipart images
        
    def create_index(self, image_list_path: str, image_resource_path: str):
        """Create FAISS index from image embeddings"""
        # Read image paths
        with open(image_list_path, 'r') as f:
            self.image_paths = [line.strip().split(',') for line in f.readlines()]
            
        # Load and process each image's data
        embeddings = []
        for idx, (image_path, json_path) in enumerate(tqdm(self.image_paths)):
            # Construct full path to the image's JSON data
            #json_path = os.path.join(image_resource_path, f'results/{idx}.json')
            
            if not os.path.exists(json_path):
                continue
            
            try:    
                with open(json_path, 'r') as f:
                    try:
                        image_info = json.load(f)
                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON at index {idx}: {str(e)}")
                        continue
                    
                # Combine multiple fields for better semantic representation
                semantic_text = ""
                try:
                    image_content = image_info.get('image_content', '')
                    topic = image_info.get('topic', '')
                    explanation = image_info.get('explanation', '')
                    
                    if image_content:
                        semantic_text += f"{image_content}"
                    if topic:
                        semantic_text += f". {topic}"
                    if explanation:
                        semantic_text += f". {explanation}"
                    
                    if not semantic_text:
                        semantic_text = "Image without description"
                        print(f"Warning: Missing semantic information for image at index {idx}")
                except Exception as e:
                    semantic_text = "Image without description"
                    print(f"Error processing semantic text at index {idx}: {str(e)}")
                
                # Generate embedding
                try:
                    embedding = self.model.encode(semantic_text)
                    embeddings.append(embedding)
                    self.image_data.append(image_info)
                    
                    # Store indices based on image type
                    if image_info.get('icon_or_clipart') == 'icon':
                        self.icon_indices.append(len(embeddings) - 1)
                    elif image_info.get('icon_or_clipart') == 'clipart':
                        self.clipart_indices.append(len(embeddings) - 1)
                except Exception as e:
                    print(f"Error generating embedding at index {idx}: {str(e)}")
                    continue
                    
            except Exception as e:
                print(f"Error processing image at index {idx}: {str(e)}")
                continue
            
        self.image_paths = [image_path for image_path, _ in self.image_paths]
        embeddings = np.array(embeddings).astype('float32')
        
        # Create and train FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings)
        
    def save_index(self, index_path, data_path):
        """Save the FAISS index and associated data"""
        faiss.write_index(self.index, index_path)
        
        # Save image data and indices
        with open(data_path, 'w') as f:
            json.dump({
                'paths': self.image_paths,
                'data': self.image_data,
                'icon_indices': self.icon_indices,
                'clipart_indices': self.clipart_indices
            }, f)
            
    def load_index(self, index_path, data_path):
        """Load the FAISS index and associated data"""
        self.index = faiss.read_index(index_path)
        
        with open(data_path, 'r') as f:
            data = json.load(f)
            self.image_paths = data['paths']
            self.image_data = data['data']
            self.icon_indices = data['icon_indices']
            self.clipart_indices = data['clipart_indices']
            
    def search(self, query_text: str, new_index = None, new_data = None, top_k: int = 5, image_type: Optional[str] = None) -> List[Dict]:
        """
        Search for similar images based on query text
        
        Args:
            query_text: The text query to search for
            new_index: Optional new FAISS index to search in addition
            new_data: Optional new data associated with new_index
            top_k: Number of results to return
            image_type: Optional filter for image type ('icon' or 'clipart')
            
        Returns:
            List of dictionaries containing image information and similarity scores
        """
        if self.index is None:
            raise ValueError("Index not loaded. Please load the index first.")
            
        # Generate query embedding
        query_embedding = self.model.encode(query_text)
        query_embedding = np.array([query_embedding]).astype('float32')
        
        results = []
        
        # 搜索旧索引
        # Determine which indices to search in
        if image_type == 'icon':
            search_indices = self.icon_indices
        elif image_type == 'clipart':
            search_indices = self.clipart_indices
        else:
            search_indices = None
            
        if search_indices:
            # Create a subset index for the specific image type
            subset_index = faiss.IndexFlatL2(self.index.d)
            subset_index.add(self.index.reconstruct_n(0, self.index.ntotal)[search_indices])
            
            # Search in the subset index
            distances, indices = subset_index.search(query_embedding, top_k)
            # Map back to original indices
            indices = [search_indices[i] for i in indices[0]]
            distances = distances[0]
        else:
            # Search in the full index
            distances, indices = self.index.search(query_embedding, top_k)
            indices = indices[0]
            distances = distances[0]
        
        # 添加旧索引结果
        for idx, distance in zip(indices, distances):
            if idx < len(self.image_paths):  # Ensure index is valid
                results.append({
                    'image_path': self.image_paths[idx],
                    'image_data': self.image_data[idx],
                    'distance': float(distance)
                })
                
        # 如果是icon类型且有新索引,搜索新索引
        if image_type == 'icon' and new_index is not None and new_data is not None:
            new_distances, new_indices = new_index.search(query_embedding, top_k)
            new_indices = new_indices[0]
            new_distances = new_distances[0]
            
            # 添加新索引结果
            for idx, distance in zip(new_indices, new_distances):
                if idx < len(new_data['index']):
                    data = new_data['index'][str(idx)]
                    # print("data: ", data)
                    results.append({
                        'image_path': data["path"],
                        'image_data': data["data"],
                        'distance': float(distance) + 0.1
                    })
                    
        # 按距离排序并返回前top_k个结果
        results.sort(key=lambda x: x['distance'])
        return results[:top_k]

def main(image_list_path: str = None, 
         image_resource_path: str = None,
         index_path: str = None,
         data_path: str = None,
         embed_model_path: str = None,
         force: bool = False):
    """
    Create and save the image index
    
    Args:
        image_list_path: Path to the file containing list of image paths
        image_resource_path: Path to the directory containing image resources
        index_path: Path to save the FAISS index
        data_path: Path to save the image data
        embed_model_path: Path to the sentence embedding model
        force: Whether to force rebuild the index if it exists
    """
    # Check if index exists and handle force flag
    if os.path.exists(index_path) and not force:
        print(f"Index file {index_path} already exists. Use --force to rebuild.")
        return 0
        
    recommender = ImageRecommender(embed_model_path)
    recommender.create_index(image_list_path, image_resource_path)
    recommender.save_index(index_path, data_path)
    print("Index built successfully!")
    return 0

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Build image index using FAISS and SentenceTransformer')
    parser.add_argument('--image_list_path', type=str, required=True, help='Path to the file containing list of image paths')
    parser.add_argument('--image_resource_path', type=str, required=True, help='Path to the directory containing image resources')
    parser.add_argument('--index_path', type=str, required=True, help='Path to save the FAISS index')
    parser.add_argument('--data_path', type=str, required=True, help='Path to save the image data')
    parser.add_argument('--embed_model_path', type=str, required=True, help='Path to the sentence embedding model')
    parser.add_argument('--force', action='store_true', help='Force rebuild even if index exists')
    
    args = parser.parse_args()
    main(
        image_list_path=args.image_list_path,
        image_resource_path=args.image_resource_path,
        index_path=args.index_path,
        data_path=args.data_path,
        embed_model_path=args.embed_model_path,
        force=args.force
    )
