import json
import torch
import numpy as np
from sentence_transformers import util
from lapjv import lapjv
import sys
import os

# Add the project root directory to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
sys.path.append(project_root)

from utils.model_loader import ModelLoader
from config import embed_model_path

library_path = 'all_seeds.json'

# Get model from ModelLoader using embed_model_path
model = ModelLoader.get_model(embed_model_path)

def get_text_similarity(text1, text2):
    # 计算两个文本的余弦相似度
    embeddings = model.encode([text1, text2], convert_to_tensor=True)
    cosine_similarity = util.pytorch_cos_sim(embeddings[0], embeddings[1])
    return cosine_similarity.item()

def get_text_list_similarity(text_list1, text_list2):
    #计算两两文本的相似度
    similarity_matrix = np.zeros((len(text_list1), len(text_list2)))
    for i, text1 in enumerate(text_list1):
        for j, text2 in enumerate(text_list2):
            similarity_matrix[i, j] = get_text_similarity(text1, text2)
    return similarity_matrix

def linear_assignment(similarity_matrix):
    # 利用lapjv算法进行线性分配,求得text_list1中的每个文本与text_list2中的哪个文本最相似
    x,y,c = lapjv(-similarity_matrix)
    return x

