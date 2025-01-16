import os
import pickle, json
import random
from ..data_enricher_modules.icon_selection import Semantics, CLIPMatcher
import numpy as np
from scipy.spatial import KDTree

raw_images_path = '/data1/liduan/generation/chart/iconset/colored_icons_final'
feature_root = '/data1/liduan/jiashu/icon_cleaner/final_feat'
semantic_knum = 50

def load_pickle(file_path):
    print('Loading', file_path)
    with open(file_path, 'rb') as f:
        data = pickle.load(f)
    return data

def load_np(file_path):
    print('Loading', file_path)
    return np.load(file_path)

class SimulatedAnnealing:
    def __init__(self, contexts: Semantics, threshold=0, topic_color = None, min_search_num=30):
        # 1. init semantics
        self.semantic = contexts
        self.max_cts = np.sum(contexts.icon_cts)
        # from IPython import embed; embed();
        self.icon_cts_total = contexts.icon_cts
        self.icon_pool_total = contexts.icon_pool
        # self.icon_dist_total = contexts.icon_dist
        self.icon_num_total = len(self.icon_pool_total)        

        # 2. init color divide
        self.pool_min_list = 3
        try:
            self.main_colors = load_np(os.path.join(feature_root, 'main_color_list_lab.npy'))
        except:
            self.main_colors = load_np(os.path.join(feature_root, 'main_color.npy'))
        self.image_hist = load_np(os.path.join(feature_root, 'image_hist.npy'))

        icon_set = set()
        for pool in self.icon_pool_total:
            icon_set.update(pool)
        icon_set = list(icon_set)
        main_colors1 = self.main_colors[icon_set]
        # main_colors2 = self.image_hist[icon_set]
        main_colors = main_colors1 # np.hstack([main_colors1, main_colors2])
        self.raw_pool = self.icon_pool_total[:]
        self.icon_pool_total = []
        icon_sets_list = []

        if topic_color is None:
            icon_sets_list = [icon_set]
        elif len(topic_color) == 1:
            delta_thres = 10.0
            cur_icon_set = []
            search_thres = min(min_search_num, len(icon_set))
            while len(cur_icon_set) < search_thres:
                for i, color in enumerate(self.main_colors):
                    if np.linalg.norm(color - topic_color[0]) < delta_thres:
                        cur_icon_set.append(i)
                delta_thres += 5.0
            icon_sets_list = [cur_icon_set]

        self.icon_sets_list = icon_sets_list
        self.color_set_init = False
        
        # 3. init local icon harmony: ink, aspect
        self.icon_ink = load_np(os.path.join(feature_root, 'ink_ratio.npy'))
        self.icon_aspect = load_np(os.path.join(feature_root, 'aspect_ratio.npy'))
        self.threshold = threshold


        # 4. init parameters
        self.disturb_iter_num = 50
        self.max_temp = 1e4
        self.min_temp = 1e-4
        self.dec = 0.99
        self.max_iter = 1e5
        self.k = semantic_knum - 1

        self.args = [2.0, 1.0, 0.0]

        # 5. init icon sets and color sets
        self.init_color_set(0)


    def __dist_lab(self, lab1, lab2):
        return np.linalg.norm(lab1 - lab2)

    def init_color_set(self, i):
        assert i < len(self.icon_sets_list) 
        use_icon_set = set(self.icon_sets_list[i])
        self.icon_pool_total = []
        for pool in self.raw_pool:
            new_pool = [icon for icon in pool if icon in use_icon_set]
            if len(new_pool) < self.pool_min_list:
                res_pool = [icon for icon in pool if icon not in use_icon_set]
                new_pool = new_pool + random.sample(res_pool, self.pool_min_list - len(new_pool))
            self.icon_pool_total.append(new_pool)
        
        self.icon_index_total = []
        for pool in self.icon_pool_total:
            index = {}
            for i, icon in enumerate(pool):
                index[icon] = i
            self.icon_index_total.append(index)
        self.image_features = load_np(os.path.join(feature_root, 'image_features.npy'))
        self.kdtrees_total = []
        for pool in self.icon_pool_total:
            idxes = np.array(pool)
            kdtree = KDTree(self.image_features[idxes])
            self.kdtrees_total.append(kdtree)
        self.color_set_init = True

    def init_icon_sets(self, icon_mode):
        assert self.color_set_init == True
        self.icon_cts = []
        self.icon_pool = []
        # self.icon_dist = []
        self.icon_index = []
        self.kdtrees = []
        cstart = 0
        cend = 0
        self.disturb_choice = []
        for i in range(len(self.icon_cts_total)):
            cend += self.icon_cts_total[i]
            if i in icon_mode:
                self.icon_cts.append(self.icon_cts_total[i])
                for j in range(cstart, cend):
                    self.icon_pool.append(self.icon_pool_total[j])
                    # self.icon_dist.append(self.icon_dist_total[j])
                    self.icon_index.append(self.icon_index_total[j])
                    self.kdtrees.append(self.kdtrees_total[j])
            cstart = cend
        self.icon_num = len(self.icon_pool)

        cur = 0
        for ct in self.icon_cts:
            if ct > 0: # 1:
                for i in range(ct):
                    self.disturb_choice.append(cur + i)
            cur += ct
        # print('disturb_choice:', self.disturb_choice)

    def cal_loss(self, icons):
        # # 1. semantic loss
        # semantic_loss = 0
        # for i in range(self.icon_num):
        #     semantic_loss += self.icon_dist[i][self.select_idx_of_pool[i]]
        # semantic_loss /= self.icon_num
        # losses.append(semantic_loss)
        # if step < 1:
        #     return losses

        ink_loss = 0
        start_idx, end_idx, ct = 0, 0, 0
        for icon_ct in self.icon_cts: # similar ink in the same level
            end_idx += icon_ct
            for i in range(start_idx, end_idx):
                for j in range(i + 1, end_idx):
                    ink_loss += max(abs(self.icon_ink[icons[i]] - self.icon_ink[icons[j]]) - self.threshold, 0)
                    ct += 1
            start_idx = end_idx
        if ct != 0:
            ink_loss /= ct

        aspect_loss = 0
        start_idx, end_idx, ct = 0, 0, 0
        for icon_ct in self.icon_cts: # similar ink in the same level
            end_idx += icon_ct
            for i in range(start_idx, end_idx):
                for j in range(i + 1, end_idx):
                    aspect_loss += max(abs(self.icon_aspect[icons[i]] - self.icon_aspect[icons[j]])- self.threshold, 0)
                    ct += 1
            start_idx = end_idx
        if ct != 0:
            aspect_loss /= ct

        # feat loss
        feat_loss = 0
        start_idx, end_idx, ct = 0, 0, 0
        for icon_ct in self.icon_cts: # similar ink in the same level
            end_idx += icon_ct
            for i in range(start_idx, end_idx):
                for j in range(i + 1, end_idx):
                    # feat_loss += np.linalg.norm(self.image_features[icons[i]] - self.image_features[icons[j]])
                    feat_loss += np.linalg.norm(self.image_hist[icons[i]] - self.image_hist[icons[j]])
                    ct += 1
            start_idx = end_idx
        if ct != 0:
            feat_loss /= ct

        return self.args[0] * ink_loss + self.args[1] * aspect_loss + self.args[2] * feat_loss, ink_loss, aspect_loss, feat_loss
    
    def select(self, idx):
        cur_pos = self.select_idx_of_pool[idx]
        cur_icon = self.icon_pool[idx][cur_pos]
        cur_kdtree = self.kdtrees[idx]
        _, indices = cur_kdtree.query(self.image_features[cur_icon].reshape(1, -1), k=min(self.k, len(self.icon_pool[idx])-1))
        indices = indices[0][1: ]
        # from IPython import embed; embed(); exit()
        subpool = [self.icon_pool[idx][i] for i in indices]
        return random.choice(subpool)
    
    def disturb(self, raw_icons):
        icons = raw_icons.copy()
        # idx = random.randint(0, len(icons) - 1)
        idx = random.choice(self.disturb_choice)
        ct = 0
        find = False
        while ct < self.disturb_iter_num:
            new_icon = self.select(idx)
            if new_icon in icons:
                pos = icons.index(new_icon)
                icons[idx] = new_icon
                idx = pos
            else:
                icons[idx] = new_icon
                find = True
                break
            ct += 1
        if not find:
            return raw_icons

        for i in range(self.icon_num):
            self.select_idx_of_pool[i] = self.icon_index[i][icons[i]]
        return icons

    def init(self):
        icons = []
        find = False
        def findway(cur_icons, idx):
            nonlocal icons, find
            if find:
                return
            if idx == self.icon_num:
                icons = cur_icons
                find = True
                return
            for icon in self.icon_pool[idx]:
                if icon not in cur_icons:
                    findway(cur_icons + [icon], idx + 1)
        findway([], 0)

        # if not find:
        #     from IPython import embed; embed(); exit()
        assert find, 'No inition solution'
        self.select_idx_of_pool = [0] * self.icon_num
        for i in range(self.icon_num):
            self.select_idx_of_pool[i] = self.icon_index[i][icons[i]]
        return icons

    def run(self, icon_mode):
        # mode: 0 topic, 1 x/y axis, 2 data
        self.init_icon_sets(icon_mode)

        # 0. init icons
        icons = self.init()
        start_loss = self.cal_loss(icons)[0]

        best_loss = start_loss
        best_icons = icons
        cur_loss = start_loss
        cur_icons = icons
        temp = self.max_temp
        iter_num = 0

        while temp > self.min_temp and iter_num < self.max_iter:
            new_icons = self.disturb(cur_icons)
            new_loss = self.cal_loss(new_icons)[0]
            delta_loss = new_loss - cur_loss
            if delta_loss < 0 or random.random() < np.exp(-delta_loss / temp):
                cur_loss = new_loss
                cur_icons = new_icons
                if new_loss < best_loss:
                    best_loss = new_loss
                    best_icons = new_icons
            temp *= self.dec
            iter_num += 1
        
        # final_loss = self.cal_loss(best_icons)
        # print('Final loss:', final_loss)
        return best_icons

import colour
import numpy as np
def hex_to_lab(hex):
    hex_color = hex_color.lstrip('#')
    rgb = np.array([
        int(hex_color[i:i+2], 16) / 255 
        for i in (0, 2, 4)
    ])
    xyz = colour.sRGB_to_XYZ(rgb)
    lab = colour.XYZ_to_Lab(xyz)
    return lab
    
class IconSelector:
    def __init__(self, pool, topic_color = None, x_label = None):
        '''
        pool: icon pool (class Semantics)
        topic_color: topic color (None or list of hex color)
        x_label: x label (None or str, judge flag or logo)
        '''
        if topic_color:
            topic_color = [hex_to_lab(color) for color in topic_color]
        self.sa = SimulatedAnnealing(pool, topic_color = topic_color, min_search_num=100)
        self.x_label = x_label

    def select(self, sequence1, sequence2):
        '''
        sequence1: list of total template sequence
        sequence2: list of chart sequence
        '''
        icon_mode = []
        if 'topic_icon' in sequence1:
            icon_mode.append(0)
        if 'x_single_icon' in sequence2:
            icon_mode.append(3)
        if 'x_multiple_icon' in sequence2:
            icon_mode.append(4)
        print(icon_mode)
        # TODO
        return self.sa.run(icon_mode)
