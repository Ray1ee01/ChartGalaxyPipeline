import json, os
import torch
import numpy as np
from sentence_transformers import SentenceTransformer, util
from config import sentence_transformer_path, infographic_library_path, infographic_image_path
model_path = sentence_transformer_path
library_path = infographic_library_path
image_root_path = infographic_image_path

class InfographicRetriever:
    def __init__(self, model_path, library_path, image_path):
        """
        Initialize the image retriever with a knowledge base and embedding model

        Args:
            library_path (str): Path to the JSON knowledge base file
            model_path (str): Path to the sentence transformer model
        """
        self.model_path = model_path
        self.library_path = library_path
        self.image_path = image_path

        # Load knowledge base
        with open(library_path, 'r', encoding='utf-8') as f:
            self.knowledge_base = json.load(f)

        # Load embedding model
        self.embedding_model = SentenceTransformer(model_path)

        # Pre-compute embeddings
        self._prepare_embeddings()

    def _combine_text_fields(self, item):
        """Combine different text fields into a single string"""
        return f"{item['title']}  {item['description']} {item['main_insight']}" + " ".join(item['columns'])

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
            results.append((os.path.join(self.image_path, doc_id + '.jpeg'), similarity, doc_id))
        return results

if __name__ == "__main__":
    retriever = InfographicRetriever(model_path, library_path, image_root_path)

    user_query = "Cat in a hat"
    similar_entries = retriever.retrieve_similar_entries(user_query, top_k=10)
    from IPython import embed; embed()
