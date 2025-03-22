from .elements import *
from .layout import *
import random
import copy
import requests
from datetime import datetime
import os
from PIL import Image as PILImage
import io
import base64

class OverlayProcessor:
    def __init__(self, reference_element: LayoutElement, target_element: LayoutElement, config: dict):
        self.reference_element = reference_element
        self.target_element = target_element
        self.config = config
        
    def process(self) -> LayoutElement:
        new_element = GroupElement()
        # new_element.children = [self.reference_element, self.target_element]
        # print("reference_element: ", self.reference_element.dump())
        # if (self.reference_element.tag == 'path' and self.reference_element._is_rect()) or self.reference_element.tag == 'rect' or self.reference_element.tag == 'text':
        if self.config['type'] =='bar':
            print("rect")
            """
            config有四个维度:
            {
                direction: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
                side: 'outside' | 'inside' | 'half'
                padding: int
                orient: 'horizontal' | 'vertical' | 'other'
            }
            """

            self.reference_element.bounding_box = self.reference_element.get_bounding_box()
            self.target_element.bounding_box = self.target_element.get_bounding_box()
            

            self.fit_in_size(self.config.get('orient', 'horizontal'), self.config.get('size_ratio', 1.0))
            
            self.target_element.bounding_box = self.target_element.get_bounding_box()

            print("self.config: ", self.config)
            
            direction = self.config.get('direction', 'center')
            side = self.config.get('side', 'outside')
            padding = self.config.get('padding', 0)
            
            if direction == 'top' or direction == 'bottom':
                height = self.reference_element.get_bounding_box().height
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
            layout_graph.add_edge_by_value(self.reference_element, self.target_element, layout_strategy)
            for edge in layout_graph.node_map[self.reference_element].nexts_edges:
                # print("edge: ", edge)
                edge.process_layout()
            self.target_element._bounding_box = self.target_element.get_bounding_box()
            print("self.target_element._bounding_box: ", self.target_element._bounding_box)
            print("self.reference_element._bounding_box: ", self.reference_element._bounding_box)
            new_element.children = [self.reference_element, self.target_element]
            return new_element
        elif self.config['type'] == 'arc':
            print("arcs")
            print("self.config: ", self.config)
            self.reference_element.bounding_box = self.reference_element.get_bounding_box()
            arcs = self.reference_element.arcs
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
            else:
                # print("arcs: ", arcs)
                new_element.children = [self.reference_element]
                return new_element
                # raise ValueError("Invalid arcs")
            self.target_element.attributes['width'] = 20
            self.target_element.attributes['height'] = 20
            self.target_element.attributes['x'] = anchor_point[0] - 10
            self.target_element.attributes['y'] = anchor_point[1] - 10
            self.target_element.attributes['preserveAspectRatio'] = 'none'
            
            circle_element = Circle(anchor_point[0], anchor_point[1], 12)
            circle_element.attributes['fill'] = self.reference_element.attributes['fill']
            circle_element.attributes['stroke'] = 'none'
            new_element.children = [self.reference_element, circle_element, self.target_element ]
            return new_element
        
    def process_replace_single(self):
        new_element = GroupElement()
        new_element.children = [self.target_element]
        if self.reference_element.tag == 'path' or self.reference_element.tag == 'rect' :
            width = self.reference_element.get_bounding_box().width
            height = self.reference_element.get_bounding_box().height
            original_width = self.target_element.get_bounding_box().width
            original_height = self.target_element.get_bounding_box().height
            width_scale = width / original_width
            height_scale = height / original_height
            hrz = 'true'
            if width_scale > height_scale:
                scale = width_scale *100
                hrz = 'true'
            else:
                scale = height_scale *100
                hrz = 'false'
            self.target_element.attributes['width'] = width*1.5
            self.target_element.attributes['height'] = height*1.5
            self.target_element.attributes['preserveAspectRatio'] = 'none'
            self.target_element.attributes['x'] = self.reference_element.get_bounding_box().minx
            self.target_element.attributes['y'] = self.reference_element.get_bounding_box().miny
            # url = "https://c858-112-98-18-9.ngrok-free.app/scale"
            # url = "http://166.111.81.24:5000/scale"
            # base64_image = self.target_element.base64
            
            # response = requests.post(url, data={'image': base64_image, 'scale': scale, 'hrz': hrz})
            # print("response: ", response.status_code, response.content)
            # if response.status_code == 200:
            #     print(f"response: {response.content}")
            #     new_base64 = response.content.decode('utf-8')
            #     self.target_element.base64 = new_base64
            #     self.target_element.attributes["xlink:href"] =  f"data:{new_base64}"
            #     # 把原图和新的图标都保存下来
            #     time_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            #     original_image_path = os.path.join(os.path.dirname(__file__), '..', '..', 'output', f'original_image_{time_stamp}.png')
            #     new_image_path = os.path.join(os.path.dirname(__file__), '..', '..', 'output', f'new_image_{time_stamp}.png')
            #     print(f"original_image_path: {original_image_path}")
            #     print(f"new_image_path: {new_image_path}")
            #     image_data = base64.b64decode(base64_image.split(';base64,')[1])
            #     image = PILImage.open(io.BytesIO(image_data))
            #     image.save(original_image_path)
            #     image_data = base64.b64decode(new_base64.split(';base64,')[1])
            #     image = PILImage.open(io.BytesIO(image_data))
            #     image.save(new_image_path)
            return new_element
        else:
            return None
    
    def process_replace_multiple(self):
        new_element = GroupElement()
        
        orient = self.config.get('orient', 'horizontal')
        if self.reference_element.tag == 'path' and self.reference_element._is_rect() or self.reference_element.tag == 'rect':
            self.reference_element.bounding_box = self.reference_element.get_bounding_box()
            # print("reference_element: ", self.reference_element.dump())
            # print("target_element: ", self.target_element.dump())
            self.fit_in_size(orient)
            num_to_stack = 0
            if orient == 'horizontal':
                num_to_stack = self.reference_element.get_bounding_box().width / self.target_element.get_bounding_box().width
            elif orient == 'vertical':
                num_to_stack = self.reference_element.get_bounding_box().height / self.target_element.get_bounding_box().height
            # 上取整
            num_to_stack = math.ceil(num_to_stack)
            current_x = self.reference_element.get_bounding_box().minx
            current_y = self.reference_element.get_bounding_box().miny
            for i in range(num_to_stack):
                # new_target_element = Image(self.target_element.base64)
                # new_target_element.attributes['width'] = self.target_element.get_bounding_box().width
                # new_target_element.attributes['height'] = self.target_element.get_bounding_box().height
                # new_target_element.attributes['preserveAspectRatio'] = self.target_element.attributes.get('preserveAspectRatio', 'none')
                new_target_element = copy.deepcopy(self.target_element)
                # new_target_element = self.target_element.copy()
                if i == num_to_stack - 1:
                    new_target_element.attributes['x'] = current_x
                    new_target_element.attributes['y'] = current_y
                    new_target_element.attributes['preserveAspectRatio'] = 'none'
                    print("orient: ", orient)
                    if orient == 'horizontal':
                        new_target_element.attributes['width'] = self.reference_element.get_bounding_box().width - (current_x - self.reference_element.get_bounding_box().minx)
                    elif orient == 'vertical':
                        new_target_element.attributes['height'] = self.reference_element.get_bounding_box().height - (current_y - self.reference_element.get_bounding_box().miny)
                        print("new_target_element: ", new_target_element.dump())
                else:
                    # 把target_element克隆一份
                    new_target_element.attributes['x'] = current_x
                    new_target_element.attributes['y'] = current_y
                    if orient == 'horizontal':
                        current_x += self.target_element.get_bounding_box().width
                    elif orient == 'vertical':
                        current_y += self.target_element.get_bounding_box().height
                new_element.children.append(new_target_element)
            return new_element
            
    
    def fit_in_size(self, orient: str='horizontal',size_scale: float=1.0):
        if self.reference_element.tag == 'path' and self.reference_element._is_rect() or self.reference_element.tag == 'rect' or self.reference_element.tag == 'text':
            # reference_element_bounding_box = self.reference_element.get_bounding_box()
            # target_element_bounding_box = self.target_element.get_bounding_box()
            # reference_element_bounding_box = self.reference_element.get_bounding_box()
            if self.reference_element._bounding_box == None:
                self.reference_element.bounding_box = self.reference_element.get_bounding_box()
            if self.target_element._bounding_box == None:
                self.target_element.bounding_box = self.target_element.get_bounding_box()
            
            if orient == 'horizontal':
                # 高度对齐
                new_height = self.reference_element.get_bounding_box().height * size_scale
                aspect_ratio = self.target_element._bounding_box.width / self.target_element._bounding_box.height
                # print("new_height: ", new_height)
                new_width = new_height * aspect_ratio
                self.target_element.attributes['height'] = new_height
                self.target_element.attributes['width'] = new_width
                # print(f"old_height: {self.target_element._bounding_box.height}, old_width: {self.target_element._bounding_box.width}")
                # print(f"new_height: {new_height}, new_width: {new_width}")
            elif orient == 'vertical':
                # 宽度对齐
                new_width = self.reference_element.get_bounding_box().width * size_scale
                # print("new_width: ", new_width)
                aspect_ratio = self.target_element._bounding_box.height / self.target_element._bounding_box.width
                new_height = new_width / aspect_ratio
                self.target_element.attributes['height'] = new_height
                self.target_element.attributes['width'] = new_width
            else:
                raise ValueError(f"Invalid direction: {direction}")
            
            
# class ReplaceProcessor:
#     def __init__(self, reference_element: LayoutElement, target_element: LayoutElement, config: dict):
#         self.reference_element = reference_element
#         self.target_element = target_element
#         self.config = config
        
        