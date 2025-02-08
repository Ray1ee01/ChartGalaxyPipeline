import os, json, time
import pickle
import numpy as np
import clip
import torch
import faiss
from ...utils.global_state import *

feature_root = '/data1/liduan/jiashu/icon_cleaner/final_feat'

def load_json(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    return data

class CLIPMatcher:
    def __init__(self):
        with open(os.path.join(feature_root, 'image_features.pkl'), 'rb') as f:
            self.info = pickle.load(f)
        self.image_features_array = np.load(os.path.join(feature_root, 'image_features.npy')).astype('float32')
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)
        # self.model, self.preprocess = clip.load("ViT-L/14", device=self.device)
        # print(self.image_features_array.shape)
        faiss.normalize_L2(self.image_features_array)
        self.index = faiss.IndexFlatIP(self.image_features_array.shape[1])
        self.index.add(self.image_features_array)

    def find_icon(self, input_text, k):
        text = clip.tokenize([input_text]).to(self.device)
        with torch.no_grad():
            text_features = self.model.encode_text(text)
        text_features = text_features.cpu().numpy().astype('float32')

        faiss.normalize_L2(text_features)
        return self.index.search(text_features, k)
    
    def find_icon_by_prompts(self, input_texts, k):
        text_feat = []
        for input_text in input_texts:
            text = clip.tokenize([input_text]).to(self.device)
            with torch.no_grad():
                text_features = self.model.encode_text(text)
            text_feat.append(text_features)
        text_features = torch.stack(text_feat, dim=0).mean(dim=0)
        text_features = text_features.cpu().numpy().astype('float32')

        faiss.normalize_L2(text_features)
        return self.index.search(text_features, k)
    
    def get_icon(self, idxes):
        return {idx: (self.info['label'][idx], self.info['file'][idx]) for idx in idxes}


class Semantics:
    def __init__(self, chart_data, topic_data, topk=20):
        self.chart_data = chart_data
        self.topic_data = topic_data
        self.icon_cts = []
        self.icon_semantics = []
        self.topk = topk

        # 0: chart topic, 1: x axis label, 2: y axis label, 3: x single icon, 4: x data, 5: group data 
        self.icon_cts = [1, 1, 1, 1]
        self.icon_semantics.append(self.topic_data['topic'])
        self.icon_semantics.append(self.chart_data['meta_data']['x_label'])
        self.icon_semantics.append(self.chart_data['meta_data']['y_label'])
        self.icon_semantics.append(self.topic_data['topic'])
        # x data
        self.icon_cts.append(len(self.chart_data['data']))
        for i in range(len(self.chart_data['data'])):
            self.icon_semantics.append(self.chart_data['data'][i]['x_data'])
        
        # x label and y label and y group
        group_num = 0
        group_set = set()
        if 'group' in self.chart_data['data'][0]:
            group_set = set([x['group'] for x in self.chart_data['data']])
            group_num = len(group_set)
        for group in group_set:
            self.icon_semantics.append('{}-{}'.format(group,self.chart_data['meta_data']['y_label']))
        self.icon_cts.append(group_num)

        # optional mode
        self.optional_modes = [
            [0, 3], # topic and x single icon
            [0, 4], # topic and x data
            [0, 1, 2], # topic, x label and y label
            [0, 3, 4], # topic, x single icon and x data
            [0, 1, 2, 3], # topic, x label, y label and x single icon
            [0, 1, 2, 4], # topic, x label, y label and x data
        ]
                
    def prepare_sets(self, matcher: CLIPMatcher):
        self.icon_pool = []
        self.icon_dist = []
        all_icon = set()
        fast_memory = {}

        debug_save = {}
        for i, semantics in enumerate(self.icon_semantics):
            prompts = []
            key_word = ''
            if isinstance(semantics, str) and any(char.isalpha() for char in semantics):
                key_word = semantics
            else:
                key_word = self.topic_data['topic']

            if key_word:
                prompts.append("{}".format(key_word))
                prompts.append("A {} icon".format(key_word))
                prompts.append("An icon of {}".format(key_word))
                prompts.append("An icon about {}".format(key_word))
                prompts.append("An icon representing {}".format(key_word))
                prompts.append("An icon describing a {}".format(key_word))

            # knn_idxes = set()
            # for prompt in prompts:
            #     if prompt in fast_memory:
            #         D, I = fast_memory[prompt]
            #     else:
            #         D, I = matcher.find_icon(prompt, self.topk)
            #         I = I[0].tolist()
            #         fast_memory[prompt] = (D, I)
            #         # print(prompt, self.topk, len(I))
            #     knn_idxes.update(I)
            # I = list(knn_idxes)
            if key_word in fast_memory:
                D, I = fast_memory[key_word]
            else:
                D, I = matcher.find_icon_by_prompts(prompts, self.topk)
                fast_memory[key_word] = (D, I)

                debug_save[key_word] = I[0].tolist()

            I = I[0].tolist()
            self.icon_pool.append(I)
            # self.icon_dist.append(1-D[0])
            all_icon.update(I)
        self.icon_positions = matcher.get_icon(list(all_icon))
        # print(len(all_icon), len(self.icon_positions))
        # exit()

        file2idx = {}
        for i, (label, file) in self.icon_positions.items():
            if file not in file2idx:
                file2idx[file] = i
        for icon_set in self.icon_pool:
            for i in range(len(icon_set)):
                icon_set[i] = file2idx[self.icon_positions[icon_set[i]][1]]
            

def get_icon_pool_old(json_file, meta_data, matcher=None):
    if matcher is None:
        # time_start = time.time()
        matcher = CLIPMatcher()
        # time_end = time.time()
        # print('time cost for CLIPMatcher: ', time_end - time_start)
    
    # time_start = time.time()
    semantics = Semantics(json_file, meta_data, topk=20)
    # time_end = time.time()
    # print('time cost for Semantics: ', time_end - time_start)
    
    # time_start = time.time()
    semantics.prepare_sets(matcher)
    # time_end = time.time()
    # print('time cost for prepare_sets: ', time_end - time_start)
    return semantics


def get_icon_pool(chart_data, topic_data, matcher=None):
    if matcher is None:
        matcher = CLIPMatcher()
    if larger_icon_pool:
        topk = 200
        print('larger icon pool')
    else:
        topk = min(50, max(20, len(chart_data['data'])*2))
    semantics = Semantics(chart_data, topic_data, topk=topk)
    semantics.prepare_sets(matcher)
    return semantics