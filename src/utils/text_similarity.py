import json
import torch
import numpy as np
from sentence_transformers import SentenceTransformer, util
from lapjv import lapjv


library_path = 'all_seeds.json'
# model_path = "/data1/jiashu/models/models--sentence-transformers--all-MiniLM-L6-v2/snapshots/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9"
model_path = "D:/VIS/Infographics/data/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9"

model = SentenceTransformer(model_path)

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

