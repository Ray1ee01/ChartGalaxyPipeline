from abc import ABC, abstractmethod
from typing import List, Union, Literal
from .elements import LayoutElement, GroupElement, BoundingBox
import math

class SizeConstraint(ABC):
    """尺寸约束基类"""
    # @abstractmethod
    # def get_scale(self, reference_element: LayoutElement, layout_element: LayoutElement) -> List[float]:
    #     pass

class WidthHeightConstraint(SizeConstraint):
    """宽度高度约束"""
    def __init__(self, max_width_ratio: float=None, max_height_ratio: float=None, min_width_ratio: float=None, min_height_ratio: float=None):
        self.max_width_ratio = max_width_ratio
        self.max_height_ratio = max_height_ratio
        self.min_width_ratio = min_width_ratio
        self.min_height_ratio = min_height_ratio
        
    def rescale(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        reference_element_bounding_box = reference_element.get_bounding_box()
        layout_element_bounding_box = layout_element.get_bounding_box()
        print("reference_element_bounding_box: ", reference_element_bounding_box)
        print("layout_element_bounding_box: ", layout_element_bounding_box)
        max_width = -1
        max_height = -1
        min_width = 1000000
        min_height = 1000000
        if self.max_width_ratio is not None:
            max_width = self.max_width_ratio * reference_element_bounding_box.width
        if self.max_height_ratio is not None:
            max_height = self.max_height_ratio * reference_element_bounding_box.height
        if self.min_width_ratio is not None:
            min_width = self.min_width_ratio * reference_element_bounding_box.width
        if self.min_height_ratio is not None:
            min_height = self.min_height_ratio * reference_element_bounding_box.height
        if max_width > 0 and min_width < 1000000:
            scale_x = (max_width + min_width)/2 / layout_element_bounding_box.width
        elif max_width > 0:
            scale_x = max_width / layout_element_bounding_box.width
        elif min_width < 1000000:
            scale_x = min_width / layout_element_bounding_box.width
        else:
            scale_x = 1.0
        if max_height > 0 and min_height < 1000000:
            scale_y = (max_height + min_height)/2 / layout_element_bounding_box.height
        elif max_height > 0:
            scale_y = max_height / layout_element_bounding_box.height
        elif min_height < 1000000:
            scale_y = min_height / layout_element_bounding_box.height
        else:
            scale_y = 1.0
        # if self.max_width_ratio is not None:
        #     scale_x = min(self.max_width_ratio, reference_element_bounding_box.width / layout_element_bounding_box.width)
        # else:
        #     scale_x = 1.0
            
        # if self.max_height_ratio is not None:
        #     scale_y_up = min(self.max_height_ratio, reference_element_bounding_box.height / layout_element_bounding_box.height)
        # if self.min_height_ratio is not None:
        #     scale_y_down = 
        # else:
        #     scale_y = 1.0
        print("scale_x: ", scale_x, "scale_y: ", scale_y)
        if (not scale_x == 1.0) or (not scale_y == 1.0):
            # print("reference_element.tag: ", reference_element.tag)
            # print("layout_element.tag: ", layout_element.tag)
            scale = layout_element.update_scale(scale_x, scale_y)
            layout_element._bounding_box = layout_element.get_bounding_box()
            # print("layout_element._bounding_box: ", layout_element._bounding_box)
            return scale
        else:
            return 1.0
        
        
class LayoutStrategy(ABC):
    """布局策略基类"""
    @abstractmethod
    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        pass
    
    @property
    def dump(self) -> dict:
        return {
            'name': self.name,
            'padding': self.padding,
            'offset': self.offset,
            'alignment': self.alignment,
            'direction': self.direction
        }
    

class VerticalLayoutStrategy(LayoutStrategy):
    """垂直布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'down', padding: float = 5, offset: float = 0):
        self.padding = padding
        self.offset = offset
        self.alignment = alignment
        self.direction = direction
        self.name = 'vertical'
        self.overlap = False
        
    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        reference_element_bounding_box = reference_element._bounding_box
        layout_element_bounding_box = layout_element._bounding_box
        
        
        baseline_x = 0
        baseline_y = 0
        
        move_x = 0
        move_y = 0
        
        if self.direction == 'up':
            baseline_y = reference_element_bounding_box.miny
            new_max_y = baseline_y - self.padding
            move_y = new_max_y - layout_element_bounding_box.maxy
        elif self.direction == 'down':
            baseline_y = reference_element_bounding_box.maxy
            new_min_y = baseline_y + self.padding
            move_y = new_min_y - layout_element_bounding_box.miny
            
        if self.alignment[0] == 'middle':
            baseline_x = (reference_element_bounding_box.maxx + reference_element_bounding_box.minx) / 2
        elif self.alignment[0] == "left":
            baseline_x = reference_element_bounding_box.minx
        elif self.alignment[0] == "right":
            baseline_x = reference_element_bounding_box.maxx

        if self.alignment[1] == 'middle':
            move_x = baseline_x - (layout_element_bounding_box.maxx + layout_element_bounding_box.minx) / 2 + self.offset
        elif self.alignment[1] == "left":
            move_x = baseline_x - layout_element_bounding_box.minx + self.offset
        elif self.alignment[1] == "right":
            move_x = baseline_x - layout_element_bounding_box.maxx + self.offset

        layout_element._bounding_box.minx += move_x
        layout_element._bounding_box.maxx += move_x
        layout_element._bounding_box.miny += move_y
        layout_element._bounding_box.maxy += move_y
        if layout_element.tag=='g':
            for child in layout_element.children:
                if child._bounding_box is None:
                    child._bounding_box = child.get_bounding_box()
                child._bounding_box.minx += move_x
                child._bounding_box.maxx += move_x
                child._bounding_box.miny += move_y
                child._bounding_box.maxy += move_y
            
        
        if self.overlap and (reference_element.tag == 'g' or layout_element.tag == 'g'):
            print('move_x: ', move_x, 'move_y: ', move_y)
            
            reference_element_valid_bounding_boxes = []
            layout_element_valid_bounding_boxes = []
            
            # 获取参考元素的有效边界框
            if reference_element.tag == 'g':
                reference_element_valid_bounding_boxes = reference_element.get_children_boundingboxes()
                for i, child in enumerate(reference_element.children):
                    if child.tag == 'path' or child.tag == 'line' or child.tag == 'g':
                        # print('child.tag: ', child.tag)
                        reference_element_valid_bounding_boxes[i] = None
            else:
                reference_element_valid_bounding_boxes = [reference_element._bounding_box]
                
            # 获取布局元素的有效边界框
            if layout_element.tag == 'g':
                layout_element_valid_bounding_boxes = layout_element.get_children_boundingboxes()
                for i, child in enumerate(layout_element.children):
                    if child.tag == 'path' or child.tag == 'line' or child.tag == 'g':
                        # print('child.tag: ', child.tag)
                        layout_element_valid_bounding_boxes[i] = None
            else:
                layout_element_valid_bounding_boxes = [layout_element._bounding_box]

            def has_overlap(move_distance: float) -> bool:
                """检查给定移动距离是否会导致重叠"""
                # 保存原始值
                original_values = []
                for layout_box in layout_element_valid_bounding_boxes:
                    original_values.append((layout_box.miny, layout_box.maxy))
                    
                # 临时移动边界框进行检查
                for layout_box in layout_element_valid_bounding_boxes:
                    if self.direction == 'up':
                        layout_box.miny += move_distance
                        layout_box.maxy += move_distance
                    else:
                        layout_box.miny -= move_distance
                        layout_box.maxy -= move_distance
                        
                # 检查是否重叠
                has_overlap = False
                for i, ref_box in enumerate(reference_element_valid_bounding_boxes):
                    if ref_box is None and reference_element.children[i].tag == 'path':
                        for j, layout_box in enumerate(layout_element_valid_bounding_boxes):
                            if layout_box is None:
                                continue
                            # print('reference_element.children[i].is_intersect(layout_box): ', reference_element.children[i].is_intersect(layout_box))
                            if reference_element.children[i].is_intersect(layout_box):
                                has_overlap = True
                                break
                    elif ref_box is None and (reference_element.children[i].tag == 'line' or reference_element.children[i].tag == 'g'):
                        has_overlap = False
                    else:
                        for j, layout_box in enumerate(layout_element_valid_bounding_boxes):
                            if layout_box is None:
                                if layout_element.children[j].is_intersect(ref_box):
                                    has_overlap = True
                                    break
                            else:
                                if layout_box.is_overlapping(ref_box):
                                    has_overlap = True
                                    break
                    if has_overlap:
                        break
                        
                # 恢复原始值
                for layout_box, (orig_miny, orig_maxy) in zip(layout_element_valid_bounding_boxes, original_values):
                    layout_box.miny = orig_miny
                    layout_box.maxy = orig_maxy
                    
                return has_overlap
            
            # 二分查找最优移动距离
            if self.direction == 'up':
                left = 0  # 最小移动距离
                right = reference_element._bounding_box.maxy - layout_element._bounding_box.maxy  # 最大移动距离
                right_mid = reference_element._bounding_box.miny - layout_element._bounding_box.miny
                best_move = 0
                old_layout_element_bounding_box_miny = layout_element._bounding_box.miny
                old_layout_element_bounding_box_maxy = layout_element._bounding_box.maxy
                while left <= right:
                    mid = (left + right) / 2
                    print("mid: ", mid)
                    if has_overlap(mid):
                        print("has_overlap: ", has_overlap(mid))
                        right = mid - 0.1
                    else:
                        left = mid + 0.1
                        best_move = mid
                print("best_move: ", best_move)
                old_best_move = best_move
                adjust_x = 0
                adjust_y = 0
                if best_move > 0:
                    if best_move > right_mid:
                        best_move = (best_move+right_mid)/2
                        height = layout_element._bounding_box.height
                        enlarge_height = abs(old_best_move-best_move)
                        new_height = height + enlarge_height
                        width = layout_element._bounding_box.width
                        ratio = new_height/width
                        new_width = ratio*width
                        layout_element.attributes['width'] = new_width
                        layout_element.attributes['height'] = new_height
                        gap_width = new_width - width
                        gap_height = new_height - height
                        adjust_x = gap_width
                        adjust_y = gap_height
                        print("adjust_x: ", adjust_x, "adjust_y: ", adjust_y)
                    layout_element._bounding_box.miny = old_layout_element_bounding_box_miny + best_move - adjust_y
                    layout_element._bounding_box.maxy = old_layout_element_bounding_box_maxy + best_move - adjust_y
            else:  # direction == 'down'
                left = 0  # 最小移动距离
                right = layout_element._bounding_box.miny - reference_element._bounding_box.miny  # 最大移动距离
                right_mid = layout_element._bounding_box.maxy - reference_element._bounding_box.maxy
                best_move = 0
                old_layout_element_bounding_box_miny = layout_element._bounding_box.miny
                old_layout_element_bounding_box_maxy = layout_element._bounding_box.maxy
                
                while left <= right:
                    mid = (left + right) / 2
                    print("mid: ", mid)
                    if has_overlap(mid):
                        print("has_overlap: ", has_overlap(mid))
                        right = mid - 0.1
                    else:
                        left = mid + 0.1
                        best_move = mid
                print("best_move: ", best_move)
                print("right_mid: ", right_mid)
                old_best_move = best_move
                adjust_x = 0
                adjust_y = 0
                if best_move > 0:
                    if best_move > right_mid:
                        best_move = (best_move+right_mid)/2
                        height = layout_element._bounding_box.height
                        enlarge_height = abs(old_best_move-best_move)
                        print("enlarge_height: ", enlarge_height)
                        new_height = height + enlarge_height
                        width = layout_element._bounding_box.width
                        ratio = new_height/width
                        new_width = ratio*width
                        layout_element.attributes['width'] = new_width
                        layout_element.attributes['height'] = new_height
                        gap_width = new_width - width
                        gap_height = new_height - height
                        adjust_x = gap_width
                        adjust_y = gap_height
                        print("adjust_x: ", adjust_x, "adjust_y: ", adjust_y)
                        
                    layout_element._bounding_box.miny = old_layout_element_bounding_box_miny - best_move 
                    layout_element._bounding_box.maxy = old_layout_element_bounding_box_maxy - best_move
                    layout_element._bounding_box.minx -= adjust_x
                    layout_element._bounding_box.maxx -= adjust_x

class HorizontalLayoutStrategy(LayoutStrategy):
    """水平布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'right', padding: float = 5, offset: float = 0):
        self.padding = padding
        self.offset = offset
        self.alignment = alignment
        self.direction = direction
        self.name = 'horizontal'
        self.overlap = False
        
    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        print("reference_element: ", reference_element.tag, reference_element.id)
        print("layout_element: ", layout_element.tag, layout_element.id)
        reference_element_bounding_box = reference_element._bounding_box
        layout_element_bounding_box = layout_element._bounding_box
        # print("reference_element_bounding_box: ", reference_element_bounding_box)
        # print("layout_element_bounding_box: ", layout_element_bounding_box)
        # print("direction: ", self.direction)
        # print("alignment: ", self.alignment)
        # print("padding: ", self.padding)
        # print("offset: ", self.offset)
        baseline_x = 0
        baseline_y = 0
        
        move_x = 0
        move_y = 0
        
        if self.direction == 'left':
            baseline_x = reference_element_bounding_box.minx
            new_max_x = baseline_x - self.padding
            move_x = new_max_x - layout_element_bounding_box.maxx
        elif self.direction == 'right':
            baseline_x = reference_element_bounding_box.maxx
            new_min_x = baseline_x + self.padding
            move_x = new_min_x - layout_element_bounding_box.minx
            
        if self.alignment[0] == 'middle':
            baseline_y = (reference_element_bounding_box.maxy + reference_element_bounding_box.miny) / 2
        elif self.alignment[0] == "top":
            baseline_y = reference_element_bounding_box.miny
        elif self.alignment[0] == "bottom":
            baseline_y = reference_element_bounding_box.maxy

        if self.alignment[1] == 'middle':
            move_y = baseline_y - (layout_element_bounding_box.maxy + layout_element_bounding_box.miny) / 2 + self.offset
        elif self.alignment[1] == "top":
            move_y = baseline_y - layout_element_bounding_box.miny + self.offset
        elif self.alignment[1] == "bottom":
            move_y = baseline_y - layout_element_bounding_box.maxy + self.offset


        layout_element._bounding_box.minx += move_x
        layout_element._bounding_box.maxx += move_x
        layout_element._bounding_box.miny += move_y
        layout_element._bounding_box.maxy += move_y
        

        
        if layout_element.tag=='g':
            for child in layout_element.children:
                child._bounding_box.minx += move_x
                child._bounding_box.maxx += move_x
                child._bounding_box.miny += move_y
                child._bounding_box.maxy += move_y
        # print("layout_element._bounding_box: ", layout_element._bounding_box)
        if self.overlap and (reference_element.tag == 'g' or layout_element.tag == 'g'):
            reference_element_valid_bounding_boxes = []
            layout_element_valid_bounding_boxes = []
            
            # 获取参考元素的有效边界框
            if reference_element.tag == 'g':
                reference_element_valid_bounding_boxes = reference_element.get_children_boundingboxes()
            else:
                reference_element_valid_bounding_boxes = [reference_element._bounding_box]
                
            # 获取布局元素的有效边界框
            if layout_element.tag == 'g':
                layout_element_valid_bounding_boxes = layout_element.get_children_boundingboxes()
            else:
                layout_element_valid_bounding_boxes = [layout_element._bounding_box]
            
            def has_overlap(move_distance: float) -> bool:
                """检查给定移动距离是否会导致重叠"""
                # 保存原始值
                original_values = []
                for layout_box in layout_element_valid_bounding_boxes:
                    original_values.append((layout_box.minx, layout_box.maxx))
                    
                # 临时移动边界框进行检查
                for layout_box in layout_element_valid_bounding_boxes:
                    if self.direction == 'left':
                        layout_box.minx += move_distance
                        layout_box.maxx += move_distance
                    else:
                        layout_box.minx -= move_distance
                        layout_box.maxx -= move_distance
                        
                # 检查是否重叠
                has_overlap = False
                for ref_box in reference_element_valid_bounding_boxes:
                    for layout_box in layout_element_valid_bounding_boxes:
                        if layout_box.is_overlapping(ref_box):
                            has_overlap = True
                            break
                    if has_overlap:
                        break
                        
                # 恢复原始值
                for layout_box, (orig_minx, orig_maxx) in zip(layout_element_valid_bounding_boxes, original_values):
                    layout_box.minx = orig_minx
                    layout_box.maxx = orig_maxx
                    
                return has_overlap
            
            # 二分查找最优移动距离
            if self.direction == 'left':
                left = 0  # 最小移动距离
                right = reference_element._bounding_box.minx - layout_element._bounding_box.minx  # 最大移动距离
                best_move = 0
                old_layout_element_bounding_box_minx = layout_element._bounding_box.minx
                old_layout_element_bounding_box_maxx = layout_element._bounding_box.maxx
                
                while left <= right:
                    mid = (left + right) / 2
                    if has_overlap(mid):
                        left = mid + 0.1
                    else:
                        right = mid - 0.1
                        best_move = mid
                
                if best_move > 0:
                    layout_element._bounding_box.minx = old_layout_element_bounding_box_minx + best_move
                    layout_element._bounding_box.maxx = old_layout_element_bounding_box_maxx + best_move
                    
            else:  # direction == 'right'
                left = 0  # 最小移动距离
                right = layout_element._bounding_box.maxx - reference_element._bounding_box.maxx  # 最大移动距离
                best_move = 0
                old_layout_element_bounding_box_minx = layout_element._bounding_box.minx
                old_layout_element_bounding_box_maxx = layout_element._bounding_box.maxx
                
                while left <= right:
                    mid = (left + right) / 2
                    if has_overlap(mid):
                        left = mid + 0.1
                    else:
                        right = mid - 0.1
                        best_move = mid
                
                if best_move > 0:
                    layout_element._bounding_box.minx = old_layout_element_bounding_box_minx - best_move
                    layout_element._bounding_box.maxx = old_layout_element_bounding_box_maxx - best_move


class RadialLayoutStrategy(LayoutStrategy):

    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: Literal['inner','outer'] = 'outer', padding: float = 5,
                 offset: float = 0, circle_center: tuple[float, float] = (0,0)):
        self.padding = padding
        self.offset = offset
        self.alignment = alignment
        self.direction = direction
        self.name = 'radial'
        self.circle_center = circle_center
        self.overlap = False

    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        reference_element_bounding_box = reference_element._bounding_box
        layout_element_bounding_box = layout_element._bounding_box

        old_x = (layout_element_bounding_box.minx + layout_element_bounding_box.maxx) / 2
        old_y = (layout_element_bounding_box.miny + layout_element_bounding_box.maxy) / 2

        move_x = 0
        move_y = 0

        if self.alignment != ['middle','middle']:
            raise NotImplementedError

        if self.offset != 0:
            raise NotImplementedError

        scale_l = -1e9 if self.direction == 'inner' else 1
        scale_r = 1 if self.direction == 'inner' else 1e9

        def is_overlapping(scale_mid):
            if not (self.overlap and (reference_element.tag == 'g' or layout_element.tag == 'g')):
                return reference_element_bounding_box.is_overlapping(layout_element_bounding_box)
            else:
                # 获取参考元素的有效边界框
                if reference_element.tag == 'g':
                    reference_element_valid_bounding_boxes = reference_element.get_children_boundingboxes()
                else:
                    reference_element_valid_bounding_boxes = [reference_element._bounding_box]

                # 获取布局元素的有效边界框
                if layout_element.tag == 'g':
                    layout_element_valid_bounding_boxes = layout_element.get_children_boundingboxes()
                else:
                    layout_element_valid_bounding_boxes = [layout_element._bounding_box]

                original_values = []
                for layout_box in layout_element_valid_bounding_boxes:
                    original_values.append((layout_box.minx, layout_box.maxx))

                layout_center_x = self.circle_center[0] + (
                        (reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2 -
                        self.circle_center[0]) * scale_mid
                layout_center_y = self.circle_center[1] + (
                        (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2 -
                        self.circle_center[1]) * scale_mid

                layout_element_bounding_box.minx = layout_center_x - layout_element_bounding_box.width / 2
                layout_element_bounding_box.maxx = layout_center_x + layout_element_bounding_box.width / 2
                layout_element_bounding_box.miny = layout_center_y - layout_element_bounding_box.height / 2
                layout_element_bounding_box.maxy = layout_center_y + layout_element_bounding_box.height / 2

                move_x = layout_center_x - old_x
                move_y = layout_center_y - old_y
                # 临时移动边界框进行检查
                for layout_box in layout_element_valid_bounding_boxes:
                    layout_box.minx += move_x
                    layout_box.maxx += move_x
                    layout_box.miny += move_y
                    layout_box.maxy -= move_y

                # 检查是否重叠
                has_overlap = False
                for ref_box in reference_element_valid_bounding_boxes:
                    for layout_box in layout_element_valid_bounding_boxes:
                        if layout_box.is_overlapping(ref_box):
                            has_overlap = True
                            break
                    if has_overlap:
                        break

                # 恢复原始值
                for layout_box, (orig_minx, orig_maxx) in zip(layout_element_valid_bounding_boxes, original_values):
                    layout_box.minx = orig_minx
                    layout_box.maxx = orig_maxx

                return has_overlap

        # binary search for the scale that two elements do not overlap
        while scale_l + 1e-9 <= scale_r:
            mid = (scale_l + scale_r) / 2

            layout_center_x = self.circle_center[0] + ((reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2 - self.circle_center[0]) * mid
            layout_center_y = self.circle_center[1] + ((reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2 - self.circle_center[1]) * mid

            layout_element_bounding_box.minx = layout_center_x - layout_element_bounding_box.width / 2
            layout_element_bounding_box.maxx = layout_center_x + layout_element_bounding_box.width / 2
            layout_element_bounding_box.miny = layout_center_y - layout_element_bounding_box.height / 2
            layout_element_bounding_box.maxy = layout_center_y + layout_element_bounding_box.height / 2

            if not is_overlapping(mid):
                scale_result = mid
                if self.direction == 'inner':
                    scale_l = mid
                else:
                    scale_r = mid
            else:
                if self.direction == 'inner':
                    scale_r = mid
                else:
                    scale_l = mid

        def dist(p1, p2):
            return ((p1[0]-p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) ** 0.5

        padding_scale = self.padding / dist(self.circle_center, ((reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2, (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2))
        if not (self.overlap and (reference_element.tag == 'g' or layout_element.tag == 'g')):
            scale_result += (-1 if self.direction == 'inner' else 1) * padding_scale

        layout_center_x = self.circle_center[0] + (
                    (reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2 -
                    self.circle_center[0]) * scale_result
        layout_center_y = self.circle_center[1] + (
                    (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2 -
                    self.circle_center[1]) * scale_result

        layout_element_bounding_box.minx = layout_center_x - layout_element_bounding_box.width / 2
        layout_element_bounding_box.maxx = layout_center_x + layout_element_bounding_box.width / 2
        layout_element_bounding_box.miny = layout_center_y - layout_element_bounding_box.height / 2
        layout_element_bounding_box.maxy = layout_center_y + layout_element_bounding_box.height / 2

        move_x = layout_center_x - old_x
        move_y = layout_center_y - old_y


        if layout_element.tag == 'g':
            for child in layout_element.children:
                child._bounding_box.minx += move_x
                child._bounding_box.maxx += move_x
                child._bounding_box.miny += move_y
                child._bounding_box.maxy += move_y


class CircularLayoutStrategy(LayoutStrategy):

    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: Literal['clock','anticlock'] = 'clock', padding: float = 5,
                 offset: float = 0, circle_center: tuple[float, float] = (0,0)):
        self.padding = padding
        self.offset = offset
        self.alignment = alignment
        self.direction = direction
        self.name = 'circular'
        self.circle_center = circle_center
        self.overlap = False

    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        reference_element_bounding_box = reference_element._bounding_box
        layout_element_bounding_box = layout_element._bounding_box

        old_x = (layout_element_bounding_box.minx + layout_element_bounding_box.maxx) / 2
        old_y = (layout_element_bounding_box.miny + layout_element_bounding_box.maxy) / 2

        move_x = 0
        move_y = 0

        if self.alignment != ['middle','middle']:
            raise NotImplementedError

        if self.offset != 0:
            raise NotImplementedError

        theta_l = 0
        theta_r = math.pi
        theta_result = math.pi

        def dist(p1, p2):
            return ((p1[0]-p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) ** 0.5
        radius = dist(self.circle_center, ((reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2, (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2))

        def rotate(p1,p2,theta):
            angle_from_circle_center = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
            new_angle = angle_from_circle_center + (1 if self.direction=='anticlock' else -1) * theta
            return p1[0] + radius * math.cos(new_angle), p1[1] + radius * math.sin(new_angle)

        def is_overlapping(theta_mid):
            if not (self.overlap and (reference_element.tag == 'g' or layout_element.tag == 'g')):
                return reference_element_bounding_box.is_overlapping(layout_element_bounding_box)
            else:
                # 获取参考元素的有效边界框
                if reference_element.tag == 'g':
                    reference_element_valid_bounding_boxes = reference_element.get_children_boundingboxes()
                else:
                    reference_element_valid_bounding_boxes = [reference_element._bounding_box]

                # 获取布局元素的有效边界框
                if layout_element.tag == 'g':
                    layout_element_valid_bounding_boxes = layout_element.get_children_boundingboxes()
                else:
                    layout_element_valid_bounding_boxes = [layout_element._bounding_box]

                original_values = []
                for layout_box in layout_element_valid_bounding_boxes:
                    original_values.append((layout_box.minx, layout_box.maxx))

                layout_center_x, layout_center_y = rotate(self.circle_center, ((reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2,
                        (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2), theta_mid)

                layout_element_bounding_box.minx = layout_center_x - layout_element_bounding_box.width / 2
                layout_element_bounding_box.maxx = layout_center_x + layout_element_bounding_box.width / 2
                layout_element_bounding_box.miny = layout_center_y - layout_element_bounding_box.height / 2
                layout_element_bounding_box.maxy = layout_center_y + layout_element_bounding_box.height / 2

                move_x = layout_center_x - old_x
                move_y = layout_center_y - old_y
                # 临时移动边界框进行检查
                for layout_box in layout_element_valid_bounding_boxes:
                    layout_box.minx += move_x
                    layout_box.maxx += move_x
                    layout_box.miny += move_y
                    layout_box.maxy -= move_y

                # 检查是否重叠
                has_overlap = False
                for ref_box in reference_element_valid_bounding_boxes:
                    for layout_box in layout_element_valid_bounding_boxes:
                        if layout_box.is_overlapping(ref_box):
                            has_overlap = True
                            break
                    if has_overlap:
                        break

                # 恢复原始值
                for layout_box, (orig_minx, orig_maxx) in zip(layout_element_valid_bounding_boxes, original_values):
                    layout_box.minx = orig_minx
                    layout_box.maxx = orig_maxx

                return has_overlap

        # binary search for the scale that two elements do not overlap
        while theta_l + 1e-9 <= theta_r:
            mid = (theta_l + theta_r) / 2

            layout_center_x, layout_center_y = rotate(self.circle_center, (
            (reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2,
            (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2), mid)

            layout_element_bounding_box.minx = layout_center_x - layout_element_bounding_box.width / 2
            layout_element_bounding_box.maxx = layout_center_x + layout_element_bounding_box.width / 2
            layout_element_bounding_box.miny = layout_center_y - layout_element_bounding_box.height / 2
            layout_element_bounding_box.maxy = layout_center_y + layout_element_bounding_box.height / 2

            if not is_overlapping(mid):
                theta_result = mid
                theta_r = mid
            else:
                theta_l = mid

        padding_theta = self.padding / radius
        if not (self.overlap and (reference_element.tag == 'g' or layout_element.tag == 'g')):
            theta_result += (1 if self.direction=='anticlock' else -1) * padding_theta

        layout_center_x, layout_center_y = rotate(self.circle_center, (
        (reference_element_bounding_box.minx + reference_element_bounding_box.maxx) / 2,
        (reference_element_bounding_box.miny + reference_element_bounding_box.maxy) / 2), theta_result)

        layout_element_bounding_box.minx = layout_center_x - layout_element_bounding_box.width / 2
        layout_element_bounding_box.maxx = layout_center_x + layout_element_bounding_box.width / 2
        layout_element_bounding_box.miny = layout_center_y - layout_element_bounding_box.height / 2
        layout_element_bounding_box.maxy = layout_center_y + layout_element_bounding_box.height / 2

        move_x = layout_center_x - old_x
        move_y = layout_center_y - old_y


        if layout_element.tag == 'g':
            for child in layout_element.children:
                child._bounding_box.minx += move_x
                child._bounding_box.maxx += move_x
                child._bounding_box.miny += move_y
                child._bounding_box.maxy += move_y

class InnerHorizontalLayoutStrategy(HorizontalLayoutStrategy):
    """内部水平布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'right', padding: float = 5, offset: float = 0):
        super().__init__(alignment, direction, padding, offset)

    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        self.padding = -layout_element.get_bounding_box().width - self.padding
        super().layout(reference_element, layout_element)

class InnerVerticalLayoutStrategy(VerticalLayoutStrategy):
    """内部垂直布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'right', padding: float = 5, offset: float = 0):
        super().__init__(alignment, direction, padding, offset)

    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        self.padding = -layout_element.get_bounding_box().height - self.padding
        super().layout(reference_element, layout_element)

class MiddleHorizontalLayoutStrategy(HorizontalLayoutStrategy):
    """中间水平布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'right', padding: float = 5, offset: float = 0):
        super().__init__(alignment, direction, padding, offset)

    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        self.padding = -layout_element.get_bounding_box().width/2 - reference_element.get_bounding_box().width/2 - self.padding
        super().layout(reference_element, layout_element)

class MiddleVerticalLayoutStrategy(VerticalLayoutStrategy):
    """中间垂直布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'right', padding: float = 5, offset: float = 0):
        super().__init__(alignment, direction, padding, offset)

    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        self.padding = -layout_element.get_bounding_box().height/2 - reference_element.get_bounding_box().height/2 - self.padding
        super().layout(reference_element, layout_element)
        

def parse_layout_strategy(reference_element: LayoutElement, layout_element: LayoutElement, layout_strategy: str = 'none') -> None:
    if reference_element._bounding_box == None:
        reference_element._bounding_box = reference_element.get_bounding_box()
    if layout_element._bounding_box == None:
        layout_element._bounding_box = layout_element.get_bounding_box()
    
    # 计算布局策略的参数
    # 在初步情况下，可以alignment都是["middle", "middle"]
    alignment = ["middle", "middle"]
    if layout_strategy == 'vertical':
        if reference_element._bounding_box.miny > layout_element._bounding_box.miny:
            layout_strategy = VerticalLayoutStrategy(alignment=alignment, direction='up')
            # 计算padding和offset
            padding = reference_element._bounding_box.miny - layout_element._bounding_box.maxy
            offset = 0
            reference_middle_x = (reference_element._bounding_box.maxx + reference_element._bounding_box.minx) / 2
            layout_element_middle_x = (layout_element._bounding_box.maxx + layout_element._bounding_box.minx) / 2
            offset = layout_element_middle_x - reference_middle_x
        # elif reference_element._bounding_box.maxy < layout_element._bounding_box.maxy:
        else:
            layout_strategy = VerticalLayoutStrategy(alignment=alignment, direction='down')
            # 计算padding和offset
            padding = layout_element._bounding_box.miny - reference_element._bounding_box.maxy
            offset = 0
            reference_middle_x = (reference_element._bounding_box.maxx + reference_element._bounding_box.minx) / 2
            layout_element_middle_x = (layout_element._bounding_box.maxx + layout_element._bounding_box.minx) / 2
            offset = layout_element_middle_x - reference_middle_x
    elif layout_strategy == 'horizontal':
        if reference_element._bounding_box.minx > layout_element._bounding_box.minx:
            layout_strategy = HorizontalLayoutStrategy(alignment=alignment, direction='left')
            # 计算padding和offset
            padding = reference_element._bounding_box.minx - layout_element._bounding_box.maxx
            offset = 0
            reference_middle_y = (reference_element._bounding_box.maxy + reference_element._bounding_box.miny) / 2
            layout_element_middle_y = (layout_element._bounding_box.maxy + layout_element._bounding_box.miny) / 2
            offset = layout_element_middle_y - reference_middle_y
        else:
            layout_strategy = HorizontalLayoutStrategy(alignment=alignment, direction='right')
            # 计算padding和offset
            padding = layout_element._bounding_box.minx - reference_element._bounding_box.maxx
            offset = 0
            reference_middle_y = (reference_element._bounding_box.maxy + reference_element._bounding_box.miny) / 2
            layout_element_middle_y = (layout_element._bounding_box.maxy + layout_element._bounding_box.miny) / 2
            offset = layout_element_middle_y - reference_middle_y
    layout_strategy.padding = padding
    layout_strategy.offset = offset
    return layout_strategy

def parse_chart_orientation(mark_group: List[LayoutElement]) -> str:
        """确定mark的朝向
        
        Args:
            mark_group: mark组节点
        
        Returns:
            str: 'left', 'right', 'up', 或 'down'
        """

       # TODO：现在只支持bar chart
       # 收集所有矩形的位置信息
        rects = []
        for mark in mark_group:
            if mark.tag == 'path' and 'bbox' in mark.attributes:
                bbox = mark.attributes['bbox']
                center_x = (bbox['minX'] + bbox['maxX']) / 2
                center_y = (bbox['minY'] + bbox['maxY']) / 2
                rects.append({
                    'center_x': center_x,
                    'center_y': center_y,
                    'min_x': bbox['minX'],
                    'max_x': bbox['maxX'],
                    'min_y': bbox['minY'],
                    'max_y': bbox['maxY']
                })
        
        if len(rects) < 2:
            return 'right'  # 如果只有一个矩形，默认朝向
        
        d_min_x = []
        d_min_y = []
        d_max_x = []
        d_max_y = []
        for i in range(len(rects) - 1):
            d_min_x.append(rects[i + 1]['min_x'] - rects[i]['max_x'])
            d_min_y.append(rects[i + 1]['min_y'] - rects[i]['max_y'])
            d_max_x.append(rects[i + 1]['max_x'] - rects[i]['min_x'])
            d_max_y.append(rects[i + 1]['max_y'] - rects[i]['min_y'])
        sum_d_min_x = abs(sum(d_min_x))
        sum_d_min_y = abs(sum(d_min_y))
        sum_d_max_x = abs(sum(d_max_x))
        sum_d_max_y = abs(sum(d_max_y))
    
        # 找到最小的sum
        min_sum = min(sum_d_min_x, sum_d_min_y, sum_d_max_x, sum_d_max_y)
        if min_sum == sum_d_min_x:
            return 'right'
        elif min_sum == sum_d_min_y:
            return 'down'
        elif min_sum == sum_d_max_x:
            return 'left'
        else:
            return 'up'
        

class Node:
    def __init__(self, value: LayoutElement):
        self.value = value
        self.prevs = []
        self.prevs_edges = []
        self.nexts = []
        self.nexts_edges = []

class Edge:
    # layout的是source. target是reference
    def __init__(self, source: Node, target: Node, value: Union[LayoutStrategy, SizeConstraint]):
        self.source = source
        self.target = target
        self.value = value
        
    def __str__(self):
        return f"Edge(source={self.source.value.tag}, target={self.target.value.tag}, value={self.value.name})"
    
    def process_layout(self):
        if self.target.value._bounding_box == None:
            self.target.value._bounding_box = self.target.value.get_bounding_box()
        old_node_min_x = float(self.target.value._bounding_box.minx)
        old_node_min_y = float(self.target.value._bounding_box.miny)
        if isinstance(self.value, LayoutStrategy):
            self.value.layout(self.source.value, self.target.value)
            self.target.value.update_pos(old_node_min_x, old_node_min_y)
        elif isinstance(self.value, SizeConstraint):
            scale = self.value.rescale(self.source.value, self.target.value)
            return scale
        
    def dump(self):
        return {
            'source': self.source.value.tag,
            'target': self.target.value.tag,
            'value': self.value.dump
        }
        
class LayoutGraph:
    def __init__(self):
        self.nodes = []
        self.node_map = {}
        
    def add_node(self, node: Node):
        self.nodes.append(node)
        self.node_map[node.value] = node
    
    def add_edge(self, source: Node, target: Node, value: Union[LayoutStrategy, SizeConstraint]):
        source.nexts.append(target)
        source.nexts_edges.append(Edge(source, target, value))
        target.prevs.append(source)
        target.prevs_edges.append(Edge(source, target, value))
    
    def remove_edge(self, source: Node, target: Node):
        source_idx = source.nexts.index(target)
        target_idx = target.prevs.index(source)
        source.nexts.pop(source_idx)
        source.nexts_edges.pop(source_idx)
        target.prevs.pop(target_idx)
        target.prevs_edges.pop(target_idx)
    
    def add_edge_by_value(self, source: LayoutElement, target: LayoutElement, value: Union[LayoutStrategy, SizeConstraint]):
        if source not in self.node_map:
            self.add_node(Node(source))
        if target not in self.node_map:
            self.add_node(Node(target))
        source_node = self.node_map[source]
        target_node = self.node_map[target]
        self.add_edge(source_node, target_node, value)
    
    def add_node_with_edges(self, source: LayoutElement, target: LayoutElement, value: Union[LayoutStrategy, SizeConstraint]):
        if source not in self.node_map:
            self.add_node(Node(source))
        if target not in self.node_map:
            self.add_node(Node(target))
        source_node = self.node_map[source]
        target_node = self.node_map[target]
        if isinstance(value, LayoutStrategy):
            if target_node.nexts == [] and target_node.prevs == []:
                for next, next_value in zip(source_node.nexts, source_node.nexts_edges):
                    if next_value.value.name == value.name and next_value.value.direction == value.direction:
                        self.add_edge(target_node, next, next_value.value)
                        self.remove_edge(source_node, next)
                        break
            elif source_node.nexts == [] and source_node.prevs == []:
                for prev, prev_value in zip(target_node.prevs, target_node.prevs_edges):
                    if prev_value.value.name == value.name and prev_value.value.direction == value.direction:
                        self.add_edge(prev, source_node, prev_value.value)
                        self.remove_edge(prev, target_node)
                        break
        self.add_edge_by_value(source, target, value)
            
        
    def visualize(self):
        """可视化图结构"""
        try:
            import networkx as nx
            import matplotlib.pyplot as plt
            import numpy as np
        except ImportError:
            print("请先安装networkx和matplotlib: pip install networkx matplotlib")
            return
            
        G = nx.DiGraph()
        
        # 使用简单的整数作为节点ID
        node_mapping = {node: idx for idx, node in enumerate(self.nodes)}
        
        # 添加节点
        for node in self.nodes:
            node_id = node_mapping[node]
            node_label = f"{node.value.tag}"
            G.add_node(node_id, label=node_label)
            
        # 添加边
        for node in self.nodes:
            node_id = node_mapping[node]
            for next_node, edge in zip(node.nexts, node.nexts_edges):
                next_id = node_mapping[next_node]
                edge_label = edge.name if hasattr(edge, 'name') else edge.__class__.__name__
                G.add_edge(node_id, next_id, label=edge_label)
        plt.figure(figsize=(12, 8))
        
        # 绘制图
        pos = nx.spring_layout(G, k=1, iterations=100)
        
        # 绘制节点
        nx.draw_networkx_nodes(G, pos, 
                              node_color='lightblue', 
                              node_size=1000)
        
        # 绘制边
        nx.draw_networkx_edges(G, pos, 
                              edge_color='gray',
                              arrows=True,
                              arrowsize=20)
        
        # 绘制节点标签
        labels = nx.get_node_attributes(G, 'label')
        nx.draw_networkx_labels(G, pos, labels, 
                               font_size=8,
                               font_weight='bold')
        
        # 绘制边标签
        edge_labels = nx.get_edge_attributes(G, 'label')
        nx.draw_networkx_edge_labels(G, pos, edge_labels,
                                    font_size=8)
        plt.title("Layout Graph")
        plt.axis('off')
        plt.savefig("layout_graph.png")
        
        # # 确保图形完全渲染
        # plt.tight_layout()
                
        # 保存图形
        
