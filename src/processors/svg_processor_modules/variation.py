# 抽象类
from abc import ABC, abstractmethod
from .elements import *
from .layout import *


class VariationProcessor(ABC):
    def __init__(self):
        pass
    
    @abstractmethod
    def process(self):
        pass
    

class ImageChart(VariationProcessor):
    def __init__(self, chart: Chart, image: UseImage):
        super().__init__()
        self.chart = chart
        self.image = image
        
    def process(self, config: dict):
        if config['variation_type'] == 'overlay':
            return self.overlay(config)
        elif config['variation_type'] == 'behind':
            return self.behind(config)
        elif config['variation_type'] == 'side':
            return self.side(config)
        
    def overlay(self, config: dict):
        self.chart._bounding_box = self.chart.get_bounding_box()
        self.image._bounding_box = self.image.get_bounding_box()
        
        # 选择一个合适的位置，默认放在chart中心
        self.image.attributes['x'] = self.chart._bounding_box.minx + (self.chart._bounding_box.width - self.image._bounding_box.width) / 2
        self.image.attributes['y'] = self.chart._bounding_box.miny + (self.chart._bounding_box.height - self.image._bounding_box.height) / 2
        
        return [self.chart, self.image]
    
    def behind(self, config: dict):
        self.chart._bounding_box = self.chart.get_bounding_box()
        self.image._bounding_box = self.image.get_bounding_box()
        
        # 选择一个合适的位置，默认放在chart中心
        self.image.attributes['x'] = self.chart._bounding_box.minx + (self.chart._bounding_box.width - self.image._bounding_box.width) / 2
        self.image.attributes['y'] = self.chart._bounding_box.miny + (self.chart._bounding_box.height - self.image._bounding_box.height) / 2
        
        
        return [self.image, self.chart]
    
    def side(self, config: dict):
        self.chart._bounding_box = self.chart.get_bounding_box()
        self.image._bounding_box = self.image.get_bounding_box()
        
        # 选择一个合适的位置，默认放在chart中心
        self.image.attributes['x'] = self.chart._bounding_box.minx + (self.chart._bounding_box.width - self.image._bounding_box.width) / 2
        self.image.attributes['y'] = self.chart._bounding_box.miny + (self.chart._bounding_box.height - self.image._bounding_box.height) / 2
        
        return [self.chart, self.image]

class PictogramMark(VariationProcessor):
    def __init__(self, mark: Mark, pictogram: UseImage):
        super().__init__()
        self.mark = mark
        self.pictogram = pictogram
        
    def process(self, config: dict):
        self.config = config
        if config['variation_type'] == 'side':
            if isinstance(self.mark, BarMark):
                return self.side_bar_mark(config)
            elif isinstance(self.mark, PathMark):
                return self.side_path_mark(config)
            elif isinstance(self.mark, ArcMark):
                return self.side_arc_mark(config)
            elif isinstance(self.mark, AreaMark):
                return self.side_area_mark(config)
            elif isinstance(self.mark, PointMark):
                return self.side_point_mark(config)
        elif config['variation_type'] == 'overlay':
            if isinstance(self.mark, BarMark):
                return self.overlay_bar_mark(config)
            elif isinstance(self.mark, PathMark):
                return self.overlay_path_mark(config)
            elif isinstance(self.mark, ArcMark):
                return self.overlay_arc_mark(config)
            elif isinstance(self.mark, AreaMark):
                return self.overlay_area_mark(config)
            elif isinstance(self.mark, PointMark):
                return self.overlay_point_mark(config)
        elif config['variation_type'] == 'replace':
            if isinstance(self.mark, BarMark):
                return self.replace_bar_mark(config)
            if isinstance(self.mark, PathMark):
                return self.replace_path_mark(config)
            if isinstance(self.mark, ArcMark):
                return self.replace_arc_mark(config)
            if isinstance(self.mark, AreaMark):
                return self.replace_area_mark(config)
            if isinstance(self.mark, PointMark):
                return self.replace_point_mark(config)

    def side_bar_mark(self, config: dict): 
        self.mark._bounding_box = self.mark.get_bounding_box()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()

        self.fit_in_size(self.mark.orient, config.get('size_ratio', 1.0))
        
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        
        direction = config.get('direction', 'right')
        padding = config.get('padding', 10)
        if direction == 'top' or direction == 'bottom':
            height = self.mark.get_bounding_box().height
            if direction == 'top':
                direction = 'up'
            elif direction == 'bottom':
                direction = 'down'
            layout_strategy = VerticalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)

        elif direction == 'left' or direction == 'right':
            if direction == 'left':
                direction = 'left'
            elif direction == 'right':
                direction = 'right'
            layout_strategy = HorizontalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
        
        layout_graph = LayoutGraph()
        layout_graph.add_edge_by_value(self.mark, self.pictogram, layout_strategy)
        for edge in layout_graph.node_map[self.mark].nexts_edges:
            edge.process_layout()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        self.mark.children.append(self.pictogram)
        return self.mark

    def side_path_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("PathMark is not implemented")
    
    def side_arc_mark(self, config: dict):
        self.mark._bounding_box = self.mark.get_bounding_box()
        arcs = self.mark.children[0].arcs
        if len(arcs.keys()) == 1:
            arc = arcs[list(arcs.keys())[0]]
            anchor_point = arc['center']
        elif len(arcs.keys()) > 1:
            max_rx = 0
            min_rx = 10000
            max_key = None
            for key, arc in arcs.items():
                if arc['rx'] > max_rx:
                    max_rx = arc['rx']
                    max_key = key
                if arc['rx'] < min_rx:
                    min_rx = arc['rx']
                    min_key = key
            if self.config['arc']['side'] == 'outer':
                anchor_point = arcs[max_key]['outer']
            elif self.config['arc']['side'] == 'inner':
                anchor_point0 = arcs[max_key]['center']
                anchor_point1 = arcs[min_key]['center']
                anchor_point = (anchor_point0[0] + anchor_point1[0]) / 2, (anchor_point0[1] + anchor_point1[1]) / 2
            else:
                anchor_point = arcs[max_key]['center']
        self.pictogram.attributes['width'] = 20
        self.pictogram.attributes['height'] = 20
        self.pictogram.attributes['x'] = anchor_point[0] - 10
        self.pictogram.attributes['y'] = anchor_point[1] - 10
        self.pictogram.attributes['preserveAspectRatio'] = 'none'
        
        # circle_element = Circle(anchor_point[0], anchor_point[1], 12)
        # circle_element.attributes['fill'] = self.mark.attributes['fill']
        # # 这里可能会错误
        # circle_element.attributes['stroke'] = 'none'
        # self.mark.children.append(circle_element)
        self.mark.children.append(self.pictogram)
        return self.mark

    def side_area_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("AreaMark is not implemented")
    
    def side_point_mark(self, config: dict):
        self.mark._bounding_box = self.mark.get_bounding_box()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        
        self.pictogram.attributes['width'] = self.mark._bounding_box.width
        self.pictogram.attributes['height'] = self.mark._bounding_box.height
        self.pictogram.attributes['x'] = self.mark._bounding_box.minx
        self.pictogram.attributes['y'] = self.mark._bounding_box.miny
        self.pictogram.attributes['preserveAspectRatio'] = 'none'

        self.mark.children.append(self.pictogram)
        return self.mark
    
    def overlay_bar_mark(self, config: dict):
        self.mark._bounding_box = self.mark.get_bounding_box()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        
        self.fit_in_size(self.mark.orient, config.get('size_ratio', 1.0))
        
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()

        direction = config.get('direction', 'right')
        padding = config.get('padding', 10)
        side = config.get('side', 'inside')
        
        if direction == 'top' or direction == 'bottom':
            height = self.mark.get_bounding_box().height
            if direction == 'top':
                direction = 'up'
            elif direction == 'bottom':
                direction = 'down'
            if side == 'inside':
                layout_strategy = InnerVerticalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
            elif side == 'half':
                layout_strategy = MiddleVerticalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)

        elif direction == 'left' or direction == 'right':
            if direction == 'left':
                direction = 'left'
            elif direction == 'right':
                direction = 'right'
            if side == 'inside':
                layout_strategy = InnerHorizontalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
            elif side == 'half':
                layout_strategy = MiddleHorizontalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
        
        layout_graph = LayoutGraph()
        layout_graph.add_edge_by_value(self.mark, self.pictogram, layout_strategy)
        for edge in layout_graph.node_map[self.mark].nexts_edges:
            edge.process_layout()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        self.mark.children.append(self.pictogram)
        return self.mark
    
    def overlay_path_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("PathMark is not implemented")
    
    def overlay_arc_mark(self, config: dict):
        self.mark._bounding_box = self.mark.get_bounding_box()
        arcs = self.mark.children[0].arcs
        if len(arcs.keys()) == 1:
            arc = arcs[list(arcs.keys())[0]]
            anchor_point = arc['center']
        elif len(arcs.keys()) > 1:
            max_rx = 0
            min_rx = 10000
            max_key = None
            for key, arc in arcs.items():
                if arc['rx'] > max_rx:
                    max_rx = arc['rx']
                    max_key = key
                if arc['rx'] < min_rx:
                    min_rx = arc['rx']
                    min_key = key
            if self.config['arc']['side'] == 'inner':
                anchor_point0 = arcs[max_key]['center']
                anchor_point1 = arcs[min_key]['center']
                anchor_point = (anchor_point0[0] + anchor_point1[0]) / 2, (anchor_point0[1] + anchor_point1[1]) / 2
            else:
                anchor_point = arcs[max_key]['center']
        self.pictogram.attributes['width'] = 20
        self.pictogram.attributes['height'] = 20
        self.pictogram.attributes['x'] = anchor_point[0] - 10
        self.pictogram.attributes['y'] = anchor_point[1] - 10
        self.pictogram.attributes['preserveAspectRatio'] = 'none'
        
        circle_element = Circle(anchor_point[0], anchor_point[1], 12)
        circle_element.attributes['fill'] = self.mark.children[0].attributes['fill']
        circle_element.attributes['stroke'] = 'none'
        self.mark.children.append(circle_element)
        self.mark.children.append(self.pictogram)
        return self.mark
    
    def overlay_area_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("AreaMark is not implemented")
    
    def overlay_point_mark(self, config: dict):
        return self.side_point_mark(config)
    
    
    def replace_bar_mark(self, config: dict):
        self.mark._bounding_box = self.mark.get_bounding_box()
        copy_attributes(self.mark, self.pictogram)
        self.pictogram.attributes['width'] = self.mark._bounding_box.width
        self.pictogram.attributes['height'] = self.mark._bounding_box.height
        self.pictogram.attributes['x'] = self.mark._bounding_box.minx
        self.pictogram.attributes['y'] = self.mark._bounding_box.miny
        self.pictogram.attributes['preserveAspectRatio'] = 'none'
        
        self.mark.children = [self.pictogram]
        return self.mark
    
    def replace_path_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("PathMark is not implemented")
    
    def replace_arc_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("ArcMark is not implemented")
    
    def replace_area_mark(self, config: dict):
        # not implemented
        raise NotImplementedError("AreaMark is not implemented")
    
    def replace_point_mark(self, config: dict):
        self.mark._bounding_box = self.mark.get_bounding_box()

        copy_attributes(self.mark, self.pictogram)
        self.pictogram.attributes['width'] = self.mark._bounding_box.width
        self.pictogram.attributes['height'] = self.mark._bounding_box.height
        self.pictogram.attributes['x'] = self.mark._bounding_box.minx
        self.pictogram.attributes['y'] = self.mark._bounding_box.miny
        self.pictogram.attributes['preserveAspectRatio'] = 'none'
        
        self.mark.children = [self.pictogram]
        return self.mark
    
    def fit_in_size(self, orient: str='horizontal',size_scale: float=1.0):
        if isinstance(self.mark, BarMark):
            if self.mark._bounding_box == None:
                self.mark.bounding_box = self.mark.get_bounding_box()
            if self.pictogram._bounding_box == None:
                self.pictogram.bounding_box = self.pictogram.get_bounding_box()
            
            if orient == 'horizontal':
                # 高度对齐
                new_height = self.mark.get_bounding_box().height * size_scale
                aspect_ratio = self.pictogram._bounding_box.width / self.pictogram._bounding_box.height
                # print("new_height: ", new_height)
                new_width = new_height * aspect_ratio
                self.pictogram.attributes['height'] = new_height
                self.pictogram.attributes['width'] = new_width
                # print(f"old_height: {self.pictogram._bounding_box.height}, old_width: {self.pictogram._bounding_box.width}")
                # print(f"new_height: {new_height}, new_width: {new_width}")
            elif orient == 'vertical':
                # 宽度对齐
                new_width = self.mark.get_bounding_box().width * size_scale
                # print("new_width: ", new_width)
                aspect_ratio = self.pictogram._bounding_box.height / self.pictogram._bounding_box.width
                new_height = new_width / aspect_ratio
                self.pictogram.attributes['height'] = new_height
                self.pictogram.attributes['width'] = new_width
            else:
                raise ValueError(f"Invalid direction")


class AxisLabelMark(VariationProcessor):
    def __init__(self, axislabel: AxisLabel, pictogram: UseImage):
        super().__init__()
        self.axislabel = axislabel
        self.pictogram = pictogram
        
    def process(self, config: dict):
        if config['variation_type'] == 'replace':
            return self.replace(config)
        elif config['variation_type'] == 'side':
            return self.side(config)


    def side(self, config: dict):
        self.axislabel._bounding_box = self.axislabel.get_bounding_box()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        self.config = config
        
        self.fit_in_size(None, config.get('size_ratio', 1.0))
        
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()

        print("self.config: ", self.config)
        
        direction = config.get('direction', 'right')
        side = config.get('side', 'outside')
        padding = config.get('padding', 10)
        
        if direction == 'top' or direction == 'bottom':
            height = self.axislabel.get_bounding_box().height
            if direction == 'top':
                direction = 'up'
            elif direction == 'bottom':
                direction = 'down'
            if side == 'outside':
                layout_strategy = VerticalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
            elif side == 'inside':
                layout_strategy = InnerVerticalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
            elif side == 'half':
                layout_strategy = MiddleVerticalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)

        elif direction == 'left' or direction == 'right':
            if direction == 'left':
                direction = 'left'
            elif direction == 'right':
                direction = 'right'
            if side == 'outside':
                layout_strategy = HorizontalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
            elif side == 'inside':
                layout_strategy = InnerHorizontalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
            elif side == 'half':
                layout_strategy = MiddleHorizontalLayoutStrategy(alignment=['middle', 'middle'], direction=direction, padding=padding)
        
        layout_graph = LayoutGraph()
        layout_graph.add_edge_by_value(self.axislabel, self.pictogram, layout_strategy)
        for edge in layout_graph.node_map[self.axislabel].nexts_edges:
            edge.process_layout()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        old_bounding_box = self.axislabel._bounding_box
        # print("old_bounding_box: ", old_bounding_box)
        self.axislabel.children.append(self.pictogram)
        self.axislabel._bounding_box = self.axislabel.get_bounding_box()
        new_bounding_box = self.axislabel._bounding_box
        # print("new_bounding_box: ", new_bounding_box)
        
        shift_x = 0
        shift_y = 0
        # if self.axislabel.axis_orient == "left":
        shift_x = old_bounding_box.maxx - new_bounding_box.maxx
        # elif self.axislabel.axis_orient == "right":
        #     shift_x = old_bounding_box.minx - new_bounding_box.minx
        # elif self.axislabel.axis_orient == "top":
        #     shift_y = old_bounding_box.maxy - new_bounding_box.maxy
        # elif self.axislabel.axis_orient == "bottom":
        shift_y = old_bounding_box.miny - new_bounding_box.miny
        old_transform = self.axislabel.attributes.get('transform', "")
        print("shift_x: ", shift_x)
        print("shift_y: ", shift_y)
        self.axislabel.attributes['transform'] = f"translate({shift_x}, {shift_y}) {old_transform}"
        self.axislabel._bounding_box = self.axislabel.get_bounding_box()
        return self.axislabel
    
    def replace(self, config: dict):
        self.axislabel._bounding_box = self.axislabel.get_bounding_box()
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        self.fit_in_size(None, config.get('size_ratio', 1.0))
        self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        self.axislabel.children = [self.pictogram]
        return self.axislabel
    
    def fit_in_size(self, orient: str='horizontal',size_scale: float=1.0):
        if isinstance(self.axislabel, AxisLabel):
            font_size = float(self.axislabel.children[0].attributes['font-size'].split('px')[0])*2
            origin_width, origin_height = Image.get_image_size(self.pictogram.base64)
            aspect_ratio = origin_width / origin_height
            if self.config['direction'] == 'left' or self.config['direction'] == 'right':
                self.pictogram.attributes['height'] = font_size
                self.pictogram.attributes['width'] = font_size * aspect_ratio
            elif self.config['direction'] == 'top' or self.config['direction'] == 'bottom':
                self.pictogram.attributes['width'] = font_size
                self.pictogram.attributes['height'] = font_size / aspect_ratio
            self.pictogram.attributes['preserveAspectRatio'] = 'none'
            self.pictogram._bounding_box = self.pictogram.get_bounding_box()
        
            
            
