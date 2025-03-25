# 抽象类
from abc import ABC, abstractmethod
from .elements import *
from .layout import *
from .svg_to_mask import *
from .tree_converter import *
import math
import random
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
import scipy.signal
from .image_processor import *
import cv2

class VariationProcessor(ABC):
    def __init__(self):
        pass
    
    @abstractmethod
    def process(self):
        pass
    
class BackgroundChart(VariationProcessor):
    def __init__(self, chart: Chart):
        super().__init__()
        self.chart = chart
        
    def process(self, config: dict):
        if config['type'] == 'styled':
            return self.process_grid(config)
        else:
            return self.chart
    
    def process_grid(self, config: dict):
        if config['orientation'] == 'vertical':
            x_axis = None
            y_axis = None
            for child in self.chart.children:
                if child.attributes.get("class","") == "axis X":
                    x_axis = child
                elif child.attributes.get("class","") == "axis Y":
                    y_axis = child
            x_axis_tick_group = None
            x_axis_domain_group = None
            for child in x_axis.children:
                if child.attributes.get("class","") == 'axis_tick-group':
                    x_axis_tick_group = child
                elif child.attributes.get("class","") == 'axis_domain-group':
                    x_axis_domain_group = child
            y_axis_tick_group = None
            y_axis_domain_group = None
            for child in y_axis.children:
                if child.attributes.get("class","") == 'axis_tick-group':
                    y_axis_tick_group = child
                elif child.attributes.get("class","") == 'axis_domain-group':
                    y_axis_domain_group = child
            tick_mid_x_list = []
            x_axis_transform = x_axis.get_transform_matrix
            for tick in x_axis_tick_group.children:
                tick._bounding_box = tick.get_bounding_box()
                bbox = tick._apply_transform(tick._bounding_box.minx, tick._bounding_box.miny, tick._bounding_box.maxx, tick._bounding_box.maxy, x_axis_transform)
                tick_mid_x_list.append((bbox.minx + bbox.maxx) / 2)
            gap_sum = 0
            for i in range(len(tick_mid_x_list)-1):
                gap_sum += abs(tick_mid_x_list[i+1]-tick_mid_x_list[i])
            gap_avg = gap_sum / (len(tick_mid_x_list)-1)
            band_width = gap_avg
            background = Background()
            y_axis_transform = y_axis.get_transform_matrix
            y_axis_domain_group_bounding_box = y_axis_domain_group.get_bounding_box()
            y_axis_domain_group_bounding_box = y_axis_domain_group._apply_transform(y_axis_domain_group_bounding_box.minx, y_axis_domain_group_bounding_box.miny, y_axis_domain_group_bounding_box.maxx, y_axis_domain_group_bounding_box.maxy, y_axis_transform)
            band_height = y_axis_domain_group_bounding_box.height
            min_y = y_axis_domain_group_bounding_box.miny
            for i in range(len(tick_mid_x_list)):
                band = Rect()
                band.attributes['x'] = tick_mid_x_list[i]-gap_avg/2
                band.attributes['y'] = min_y
                band.attributes['width'] = band_width
                band.attributes['height'] = band_height
                if i % 2 == 0:
                    band.attributes['fill'] = '#f0f0f0'
                else:
                    band.attributes['fill'] = '#ffffff'
                background.children.append(band)
            self.chart.children.insert(0, background)
        elif config['orientation'] == 'horizontal':
            y_axis = None
            for child in self.chart.children:
                if child.attributes.get("class","") == "axis X":
                    x_axis = child
                elif child.attributes.get("class","") == "axis Y":
                    y_axis = child
            y_axis_tick_group = None
            y_axis_domain_group = None
            for child in y_axis.children:
                if child.attributes.get("class","") == 'axis_tick-group':
                    y_axis_tick_group = child
                elif child.attributes.get("class","") == 'axis_domain-group':
                    y_axis_domain_group = child
            x_axis_tick_group = None
            x_axis_domain_group = None
            for child in x_axis.children:
                if child.attributes.get("class","") == 'axis_tick-group':
                    x_axis_tick_group = child
                elif child.attributes.get("class","") == 'axis_domain-group':
                    x_axis_domain_group = child
            tick_mid_y_list = []
            y_axis_transform = y_axis.get_transform_matrix
            for tick in y_axis_tick_group.children:
                tick._bounding_box = tick.get_bounding_box()
                bbox = tick._apply_transform(tick._bounding_box.minx, tick._bounding_box.miny, tick._bounding_box.maxx, tick._bounding_box.maxy, y_axis_transform)
                tick_mid_y_list.append((bbox.miny + bbox.maxy) / 2)
            gap_sum = 0
            for i in range(len(tick_mid_y_list)-1):
                gap_sum += abs(tick_mid_y_list[i+1]-tick_mid_y_list[i])
            gap_avg = gap_sum / (len(tick_mid_y_list)-1)
            band_height = gap_avg
            background = Background()
            x_axis_transform = x_axis.get_transform_matrix
            x_axis_domain_group_bounding_box = x_axis_domain_group.get_bounding_box()
            x_axis_domain_group_bounding_box = x_axis_domain_group._apply_transform(x_axis_domain_group_bounding_box.minx, x_axis_domain_group_bounding_box.miny, x_axis_domain_group_bounding_box.maxx, x_axis_domain_group_bounding_box.maxy, x_axis_transform)
            band_width = x_axis_domain_group_bounding_box.width
            min_x = x_axis_domain_group_bounding_box.minx
            for i in range(len(tick_mid_y_list)):
                band = Rect()
                band.attributes['x'] = min_x
                band.attributes['y'] = tick_mid_y_list[i]-gap_avg/2
                band.attributes['width'] = band_width
                band.attributes['height'] = band_height
                if i % 2 == 0:
                    band.attributes['fill'] = '#f0f0f0'
                else:
                    band.attributes['fill'] = '#ffffff'
                background.children.append(band)
            self.chart.children.insert(0, background)
        return self.chart
        
def find_position_by_convolution(svg: str, element: LayoutElement, objectives: dict = None):
    # 获取SVG的mask信息
    debug_image, mask_image, mask_grid, grid_info = svg_to_mask(svg)
    debug_image.save('debug_image.png')
    svg_height = grid_info['dimensions']['height']
    svg_width = grid_info['dimensions']['width']
    base64 = element.base64.split('base64,')[1]
    debug_element_image, mask_element_image, mask_element_grid, element_grid_info = image_to_mask(base64)
    debug_element_image.save('debug_element_image.png')
    
    # 获取element的初始尺寸
    element_bbox = element.get_bounding_box()
    initial_width = element_bbox.width
    initial_height = element_bbox.height
    grid_size = grid_info['grid_size']
    
    # 记录最后十次成功的尺寸和位置
    last_successful_sizes = []
    last_successful_positions = []
    
    # 不断增加尺寸直到无法放置
    current_width = initial_width
    current_height = initial_height
    
    while True:
        # 计算当前尺寸在grid中占用的格子数
        element_cols = math.ceil(current_width / grid_size)
        element_rows = math.ceil(current_height / grid_size)
        
        print(f"Trying size: {current_width}x{current_height} pixels ({element_rows}x{element_cols} grids)")
        
        # 使用mask_element_grid作为卷积核，需要调整大小以匹配当前尺寸
        kernel = cv2.resize(mask_element_grid.astype(np.float32), 
                          (element_cols, element_rows), 
                          interpolation=cv2.INTER_NEAREST)
        # valid number是kernel中1的个数
        valid_number = np.sum(kernel)
        
        # 计算卷积
        conv_result = scipy.signal.convolve2d(mask_grid, kernel, mode='valid')
        
        def find_valid_position(conv_result: np.ndarray, type: str):
            if type == 'overlay':
                # print("conv_result: ", conv_result)
                # 百分之95以上为0的位置
                return np.where(conv_result > 0.8*valid_number)
            elif type == 'side':
                return np.where(conv_result == 0)
        
        valid_positions = find_valid_position(conv_result, objectives.get('type', 'side'))
        # # 找出卷积结果为0的位置（表示完全不重叠）
        # valid_positions = np.where(conv_result == 0)
        
        if len(valid_positions[0]) == 0:
            print(f"No valid positions found for size {current_width}x{current_height}")
            break
        
        # 记录当前成功的尺寸和位置
        last_successful_sizes.append((current_width, current_height))
        
        # 随机选择一个有效位置
        random_index = np.random.randint(0, len(valid_positions[0]))
        row = valid_positions[0][random_index]
        col = valid_positions[1][random_index]
        last_successful_positions.append((row, col))
        
        # 只保留最后10个成功的位置
        if len(last_successful_positions) > 10:
            last_successful_positions = last_successful_positions[-10:]
            last_successful_sizes = last_successful_sizes[-10:]
            
        print(f"Found {len(valid_positions[0])} valid positions for size {current_width}x{current_height}")
        
        # 增加尺寸
        current_width += grid_size
        current_height += grid_size
        
        # 检查是否超出SVG边界
        if current_width > svg_width or current_height > svg_height:
            print("Reached SVG boundaries")
            break
    
    if not last_successful_positions:
        print("Could not find any valid position!")
        return None
    
    # 计算layout element的9个关键位置
    layout_positions = []
    layout_bbox = element.get_bounding_box()
    # layout_x = layout_bbox.minx
    # layout_y = layout_bbox.miny
    # layout_width = layout_bbox.width
    # layout_height = layout_bbox.height
    layout_x = 0
    layout_y = 0
    layout_width = svg_width
    layout_height = svg_height
    
    # 左上、上、右上、左、中、右、左下、下、右下
    key_points = [
        (layout_x, layout_y),  # 左上
        (layout_x + layout_width/2, layout_y),  # 上
        (layout_x + layout_width, layout_y),  # 右上
        (layout_x, layout_y + layout_height/2),  # 左
        (layout_x + layout_width/2, layout_y + layout_height/2),  # 中
        (layout_x + layout_width, layout_y + layout_height/2),  # 右
        (layout_x, layout_y + layout_height),  # 左下
        (layout_x + layout_width/2, layout_y + layout_height),  # 下
        (layout_x + layout_width, layout_y + layout_height)  # 右下
    ]
    
    direction = objectives.get('direction', 'topleft')
    direction_idx = {
        'topleft': 0,
        'top': 1,
        'topright': 2,
        'left': 3,
        'center': 4,
        'middle': 4,
        'right': 5,
        'bottomleft': 6,
        'bottom': 7,
        'bottomright': 8
    }[direction]
    print("direction: ", direction)
    
    # 找到距离layout element九个位置最近的成功位置
    # 找到距离direction最近的成功位置
    min_distance = float('inf')
    best_position = None
    best_size = None
    
    for pos, size in zip(last_successful_positions, last_successful_sizes):
        # 计算网格中心位置
        pos_x = (pos[1] + size[0]/(2*grid_size)) * grid_size  
        pos_y = (pos[0] + size[1]/(2*grid_size)) * grid_size
        
        key_point = key_points[direction_idx]
        dist = ((pos_x - key_point[0])**2 + (pos_y - key_point[1])**2)**0.5
        if dist < min_distance:
            min_distance = dist
            best_position = pos
            best_size = size
    print("key_point: ", key_point)
    # 使用最佳位置
    final_width, final_height = best_size
    row, col = best_position
    print("best_position: ", best_position)
    print("best_size: ", best_size)
    print("row, col: ", row, col)
    print("final_width, final_height: ", final_width, final_height)
    x = col * grid_size
    y = row * grid_size
    
    # 创建最终的调试可视化
    fig, axes = plt.subplots(2, 2, figsize=(15, 15))
    
    # 1. 显示原始mask grid
    axes[0,0].imshow(mask_grid, cmap='gray')
    axes[0,0].set_title('Original Mask Grid')
    
    # 2. 显示最终的卷积核
    final_element_cols = math.ceil(final_width / grid_size)
    final_element_rows = math.ceil(final_height / grid_size)
    final_kernel = kernel
    axes[0,1].imshow(final_kernel, cmap='gray')
    axes[0,1].set_title(f'Final Kernel ({final_width}x{final_height} pixels)')
    
    # 3. 显示最终的卷积结果
    final_conv_result = scipy.signal.convolve2d(mask_grid, final_kernel, mode='valid')
    conv_vis = axes[1,0].imshow(final_conv_result, cmap='viridis')
    axes[1,0].set_title('Final Convolution Result')
    plt.colorbar(conv_vis, ax=axes[1,0])
    
    # 4. 显示选中的位置和所有候选位置
    valid_map = np.zeros_like(final_conv_result)
    valid_positions = np.where(final_conv_result == 0)
    valid_map[valid_positions] = 1
    axes[1,1].imshow(valid_map, cmap='gray')
    
    # 显示所有候选位置
    for pos in last_successful_positions:
        axes[1,1].plot(pos[1], pos[0], 'bx', markersize=5)
    
    # 显示最终选择的位置
    axes[1,1].plot(col, row, 'rx', markersize=10, label='Selected Position')
    axes[1,1].legend()
    axes[1,1].set_title('Selected Position')
    
    # 在原始mask上显示选择的位置和element的边界框
    rect = plt.Rectangle(
        (col, row), 
        final_element_cols, 
        final_element_rows, 
        fill=False, 
        edgecolor='red', 
        linewidth=2
    )
    axes[0,0].add_patch(rect)
    
    plt.tight_layout()
    plt.savefig('convolution_debug.png')
    plt.close()
    
    # 打印最终结果
    print(f"Final size: {final_width}x{final_height} pixels")
    print(f"Initial size: {initial_width}x{initial_height} pixels")
    print(f"Size increase: {final_width-initial_width}x{final_height-initial_height} pixels")
    print(f"Final position: grid({row}, {col}), pixel({x}, {y})")
    
    # 更新element的位置和尺寸
    element.attributes['x'] = x
    element.attributes['y'] = y
    element.attributes['width'] = final_width
    element.attributes['height'] = final_height
    
    # 创建最终位置的可视化
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.imshow(mask_grid, cmap='gray')
    
    # 绘制所有候选位置
    for pos in last_successful_positions:
        rect = plt.Rectangle(
            (pos[1], pos[0]),
            final_element_cols,
            final_element_rows,
            fill=True,
            facecolor='blue',
            alpha=0.1,
            edgecolor='blue',
            linewidth=1
        )
        ax.add_patch(rect)
    
    # 绘制选中位置的矩形
    rect = plt.Rectangle(
        (col, row),
        final_element_cols,
        final_element_rows,
        fill=True,
        facecolor='red',
        alpha=0.3,
        edgecolor='red',
        linewidth=2
    )
    ax.add_patch(rect)
    
    ax.set_title('Final Position')
    plt.savefig('final_position_debug.png')
    plt.close()
    
    return element
    
    
    
    

def find_position(svg: str, element: LayoutElement, method: str = 'convolution', objectives: dict = None):
    """为元素在SVG中找到合适的位置
    
    Args:
        svg: SVG文件内容
        element: 要放置的元素
        method: 位置查找方法，可选值：
            - 'physics': 使用物理引擎模拟
            - [其他方法待添加]
    
    Returns:
        element: 更新了位置的元素
    """
    return find_position_by_convolution(svg, element, objectives)

class ImageChart(VariationProcessor):
    def __init__(self, chart: Chart, image: UseImage):
        super().__init__()
        self.chart = chart
        self.image = image
        
    def process(self, config: dict):
        if config['type'] == 'overlay':
            return self.overlay(config)
        elif config['type'] == 'behind':
            return self.behind(config)
        elif config['type'] == 'side':
            return self.side(config)
        
    def overlay(self, config: dict):
        objectives = {
            'direction': config.get('direction', 'topleft'),
            'type': 'overlay',
        }
        # self.image = find_position(SVGTreeConverter.element_tree_to_svg_file(self.chart), self.image, method='convolution', objectives=objectives)
        mark_group = None
        for child in self.chart.children:
            if "mark_group" in child.attributes.get('class', ""):
                mark_group = child
                break
        if mark_group is not None:
            self.image = find_position(SVGTreeConverter.element_tree_to_svg_file(mark_group), self.image, method='convolution', objectives=objectives)
            print("self.image: ", self.image)
            # 获取mark_group的transform
            old_transform = mark_group.attributes['transform']
            # 获取其中最前面的translate
            old_transform = old_transform.split(' ')[0]
            # 获取x和y
            x = old_transform.split('translate(')[1].split(',')[0]
            x = float(x)
            y = old_transform.split('translate(')[1].split(',')[1].split(')')[0]
            y = float(y)
            # 为mark_group和self.image添加translate为-x和-y的transform
            mark_group.attributes['transform'] = f"translate({-x},{-y})" + mark_group.attributes['transform']
            self.image.attributes['transform'] = f"translate({-x},{-y})" + self.image.attributes.get('transform', '')
        self.chart._bounding_box = self.chart.get_bounding_box()
        self.image._bounding_box = self.image.get_bounding_box()
        self.chart.children.append(self.image)
        # self.image.attributes['transform'] = old_transform
        return [self.chart]
    
    def behind(self, config: dict):
        self.chart._bounding_box = self.chart.get_bounding_box()
        self.image._bounding_box = self.image.get_bounding_box()
        
        # 选择一个合适的位置，默认放在chart中心
        self.image.attributes['x'] = self.chart._bounding_box.minx + (self.chart._bounding_box.width - self.image._bounding_box.width) / 2
        self.image.attributes['y'] = self.chart._bounding_box.miny + (self.chart._bounding_box.height - self.image._bounding_box.height) / 2
        
        
        return [self.image, self.chart]
    
    def side(self, config: dict):
        objectives = {
            'direction': config.get('direction', 'topleft'),
            'type': 'side',
        }
        self.image = find_position(SVGTreeConverter.element_tree_to_svg_file(self.chart), self.image, method='convolution', objectives=objectives)
        
        self.chart._bounding_box = self.chart.get_bounding_box()
        self.image._bounding_box = self.image.get_bounding_box()
        
        
        return [self.chart, self.image]

class PictogramMark(VariationProcessor):
    def __init__(self, mark: Mark, pictogram: UseImage):
        super().__init__()
        self.mark = mark
        self.pictogram = pictogram
        
    def process(self, config: dict):
        self.config = config
        if config['type'] == 'side':
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
        elif config['type'] == 'overlay':
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
        elif config['type'] == 'replace':
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
        padding = config.get('padding', 0)
        side = config.get('side', 'half')
        
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
        # return self.side_point_mark(config)
        return self.replace_point_mark(config)
    
    
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
        print("self.mark: ", self.mark.children[0].dump())
        print("self.mark._bounding_box: ", self.mark._bounding_box)
        copy_attributes(self.mark, self.pictogram)
        self.pictogram.attributes['width'] = self.mark._bounding_box.width
        self.pictogram.attributes['height'] = self.mark._bounding_box.height
        self.pictogram.attributes['x'] = self.mark._bounding_box.minx
        self.pictogram.attributes['y'] = self.mark._bounding_box.miny
        self.pictogram.attributes['preserveAspectRatio'] = 'none'
        
        base64_image = self.pictogram.base64
        base64 = base64_image.split('base64,')[1]
        base64 = ImageProcessor().crop_by_circle(base64)
        base64_image = f"data:image/png;base64,{base64}"
        self.pictogram.base64 = base64_image
        self.pictogram.attributes['xlink:href'] = base64_image
        # self.mark.children = [self.pictogram]
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
        
            
            
