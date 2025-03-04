# 抽象类
from abc import ABC, abstractmethod
from .elements import *
from .layout import *


class ReadabilityProcessor(ABC):
    def __init__(self):
        pass
    
    @abstractmethod
    def process(self):
        pass
    

class AxisReadabilityProcessor(ReadabilityProcessor):
    def __init__(self, axis: Axis):
        super().__init__()
        self.axis = axis
        
    def process(self):
        pass
    
    def avoid_label_overlap(self):
        for child in self.axis.children:
            print("child: ", child.attributes.get("class", ""))
            if child.attributes.get("class", "") == "axis_label-group":
                grand_children = child.children
                for grand_child in grand_children:
                    grand_child._bounding_box = grand_child.get_bounding_box()
                grand_children_bounding_box = [child._bounding_box for child in grand_children]
                overlap_flag = False
                for i in range(len(grand_children)):
                    for j in range(i+1, len(grand_children)):
                        # print(f"grand_children_bounding_box[{i}]: ", grand_children_bounding_box[i])
                        # print(f"grand_children_bounding_box[{j}]: ", grand_children_bounding_box[j])
                        if grand_children_bounding_box[i].is_overlapping(grand_children_bounding_box[j]):
                            overlap_flag = True
                            break
                if overlap_flag:
                    # 调整label的角度
                    for grand_child in grand_children:
                        old_boundingbox = grand_child._bounding_box
                        if grand_child.axis_orient=="bottom":
                            reference_point = [grand_child._bounding_box.maxx, grand_child._bounding_box.miny]
                        elif grand_child.axis_orient=="top":
                            reference_point = [grand_child._bounding_box.maxx, grand_child._bounding_box.maxy]
                        elif grand_child.axis_orient=="left":
                            reference_point = [grand_child._bounding_box.maxx, grand_child._bounding_box.maxy]
                        elif grand_child.axis_orient=="right":
                            reference_point = [grand_child._bounding_box.minx, grand_child._bounding_box.miny]
                        # print("grand_child.axis_orient: ", grand_child.axis_orient)
                        # print("reference_point: ", reference_point)
                        grand_child.attributes["transform"] = f"rotate(-45,{reference_point[0]},{reference_point[1]}) " + grand_child.attributes.get("transform", "")
                        new_boundingbox = grand_child.get_bounding_box()
                        # print("old_boundingbox: ", old_boundingbox)
                        # print("new_boundingbox: ", new_boundingbox)
                        shift_x = 0
                        shift_y = 0

                        if grand_child.axis_orient=="bottom":
                            # 把max_x和原来的mid_x对齐
                            new_mid_x = new_boundingbox.minx+new_boundingbox.width/2
                            old_mid_x = old_boundingbox.minx+old_boundingbox.width/2
                            shift_x = old_mid_x - new_mid_x - new_boundingbox.width/2 + 5
                            shift_y = new_boundingbox.miny - old_boundingbox.miny
                        elif grand_child.axis_orient=="top":
                            # 把min_x和原来的mid_x对齐
                            new_mid_x = new_boundingbox.minx+new_boundingbox.width/2
                            old_mid_x = old_boundingbox.minx+old_boundingbox.width/2
                            shift_x = old_mid_x - new_mid_x - new_boundingbox.width/2
                            shift_y = new_boundingbox.maxy - old_boundingbox.maxy
                        elif grand_child.axis_orient=="left":
                            # 把max_y和原来的mid_y对齐
                            new_mid_y = new_boundingbox.miny+new_boundingbox.height/2
                            old_mid_y = old_boundingbox.miny+old_boundingbox.height/2
                            shift_y = old_mid_y - new_mid_y - new_boundingbox.height/2
                            shift_x = new_boundingbox.minx - old_boundingbox.minx
                        elif grand_child.axis_orient=="right":
                            # 把min_y和原来的mid_y对齐
                            new_mid_y = new_boundingbox.miny+new_boundingbox.height/2
                            old_mid_y = old_boundingbox.miny+old_boundingbox.height/2
                            shift_y = old_mid_y - new_mid_y - new_boundingbox.height/2
                            shift_x = new_boundingbox.maxx - old_boundingbox.maxx
                        # print("shift_x: ", shift_x)
                        # print("shift_y: ", shift_y)
                        grand_child.attributes["transform"] = f"translate({shift_x},{shift_y}) " + grand_child.attributes.get("transform", "")

