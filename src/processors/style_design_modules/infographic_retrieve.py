import json
import torch
import numpy as np
from sentence_transformers import SentenceTransformer, util

library_path = 'all_seeds.json'
model_path = "/data1/jiashu/models/models--sentence-transformers--all-MiniLM-L6-v2/snapshots/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9"

class InfographicRetriever:
    def __init__(self, library_path, model_path):
        """
        Initialize the image retriever with a knowledge base and embedding model
        
        Args:
            library_path (str): Path to the JSON knowledge base file
            model_path (str): Path to the sentence transformer model
        """
        self.library_path = library_path
        self.model_path = model_path
        
        # Load knowledge base
        with open(library_path) as f:
            self.knowledge_base = json.load(f)
            
        # Load embedding model
        self.embedding_model = SentenceTransformer(model_path)
        
        # Pre-compute embeddings
        self._prepare_embeddings()
        
    def _combine_text_fields(self, item):
        """Combine different text fields into a single string"""
        return f"{item['alt_text']} {item['title']} {item['description']}"
    
    def _prepare_embeddings(self):
        """Pre-compute embeddings for all items in knowledge base"""
        self.knowledge_texts = []
        self.knowledge_ids = []
        
        for key, record in self.knowledge_base.items():
            combined_text = self._combine_text_fields(record)
            self.knowledge_texts.append(combined_text)
            self.knowledge_ids.append(key)
            
        with torch.no_grad():
            self.knowledge_embeddings = self.embedding_model.encode(
                self.knowledge_texts, 
                convert_to_tensor=True,
                normalize_embeddings=True
            )
            
    def retrieve_similar_entries(self, query_text, top_k=3):
        """
        Retrieve similar images based on text query
        
        Args:
            query_text (str): Text query to search for
            top_k (int): Number of results to return
            
        Returns:
            list: List of dictionaries containing similar entries
        """
        with torch.no_grad():
            query_emb = self.embedding_model.encode(
                query_text,
                convert_to_tensor=True,
                normalize_embeddings=True
            )

        cosine_scores = util.cos_sim(query_emb, self.knowledge_embeddings)[0]
        top_results = torch.topk(cosine_scores, k=top_k)
        
        results = []
        for score_idx, score_val in zip(top_results.indices, top_results.values):
            idx = score_idx.item()
            similarity = score_val.item()
            doc_id = self.knowledge_ids[idx]
            record = self.knowledge_base[doc_id]
            results.append(record['local_name'])
            
        return results

if __name__ == "__main__":
    retriever = ImageRetriever(library_path, model_path)
    
    user_query = "Cat in a hat"
    similar_entries = retriever.retrieve_similar_entries(user_query, top_k=2)