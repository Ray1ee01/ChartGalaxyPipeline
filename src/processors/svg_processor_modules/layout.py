from abc import ABC, abstractmethod
from typing import List
from .elements import LayoutElement, GroupElement

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
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'down', padding: float = 0, offset: float = 0):
        self.padding = padding
        self.offset = offset
        self.alignment = alignment
        self.direction = direction
        self.name = 'vertical'
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
        
        
class HorizontalLayoutStrategy(LayoutStrategy):
    """水平布局策略"""
    def __init__(self, alignment: list[str] = ['middle', 'middle'], direction: str = 'right', padding: float = 0, offset: float = 0):
        self.padding = padding
        self.offset = offset
        self.alignment = alignment
        self.direction = direction
        self.name = 'horizontal'
        
    def layout(self, reference_element: LayoutElement, layout_element: LayoutElement) -> None:
        reference_element_bounding_box = reference_element._bounding_box
        layout_element_bounding_box = layout_element._bounding_box
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
        elif self.alignment[0] == "left":
            baseline_y = reference_element_bounding_box.miny
        elif self.alignment[0] == "right":
            baseline_y = reference_element_bounding_box.maxy

        if self.alignment[1] == 'middle':
            move_y = baseline_y - (layout_element_bounding_box.maxy + layout_element_bounding_box.miny) / 2 + self.offset
        elif self.alignment[1] == "left":
            move_y = baseline_y - layout_element_bounding_box.miny + self.offset
        elif self.alignment[1] == "right":
            move_y = baseline_y - layout_element_bounding_box.maxy + self.offset

        layout_element._bounding_box.minx += move_x
        layout_element._bounding_box.maxx += move_x
        layout_element._bounding_box.miny += move_y
        layout_element._bounding_box.maxy += move_y


def parse_layout_strategy(reference_element: LayoutElement, layout_element: LayoutElement, layout_strategy: str = 'none') -> None:
    # 根据两个元素的相对位置，确定其目前使用的布局策略
    # 如果给定了布局策略，则需要计算出对应的参数，即padding, offset, alignment, direction
    # if layout_strategy == 'vertical':
    #     layout_strategy = VerticalLayoutStrategy()
    # elif layout_strategy == 'horizontal':
    #     layout_strategy = HorizontalLayoutStrategy()
    # else:
    #     # TODO：如果给定的布局策略是none，则需要计算出两个元素的相对位置，并确定其使用的布局策略
    #     return None
    
    # 计算布局策略的参数
    # 在初步情况下，可以alignment都是["middle", "middle"]
    alignment = ["middle", "middle"]
    if layout_strategy == 'vertical':
        if reference_element._bounding_box.miny > layout_element._bounding_box.maxy:
            layout_strategy = VerticalLayoutStrategy(alignment=alignment, direction='up')
            # 计算padding和offset
            padding = reference_element._bounding_box.miny - layout_element._bounding_box.maxy
            offset = 0
            reference_middle_x = (reference_element._bounding_box.maxx + reference_element._bounding_box.minx) / 2
            layout_element_middle_x = (layout_element._bounding_box.maxx + layout_element._bounding_box.minx) / 2
            offset = layout_element_middle_x - reference_middle_x
        elif reference_element._bounding_box.maxy < layout_element._bounding_box.miny:
            layout_strategy = VerticalLayoutStrategy(alignment=alignment, direction='down')
            # 计算padding和offset
            padding = reference_element._bounding_box.maxy - layout_element._bounding_box.miny
            offset = 0
            reference_middle_x = (reference_element._bounding_box.maxx + reference_element._bounding_box.minx) / 2
            layout_element_middle_x = (layout_element._bounding_box.maxx + layout_element._bounding_box.minx) / 2
            offset = layout_element_middle_x - reference_middle_x
    elif layout_strategy == 'horizontal':
        if reference_element._bounding_box.minx > layout_element._bounding_box.maxx:
            layout_strategy = HorizontalLayoutStrategy(alignment=alignment, direction='left')
            # 计算padding和offset
            padding = reference_element._bounding_box.minx - layout_element._bounding_box.maxx
            offset = 0
            reference_middle_y = (reference_element._bounding_box.maxy + reference_element._bounding_box.miny) / 2
            layout_element_middle_y = (layout_element._bounding_box.maxy + layout_element._bounding_box.miny) / 2
            offset = layout_element_middle_y - reference_middle_y
        elif reference_element._bounding_box.maxx < layout_element._bounding_box.minx:
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

class LayoutGraph:
    def __init__(self):
        self.nodes = []
        self.node_map = {}
        
    def add_node(self, node: Node):
        self.nodes.append(node)
        self.node_map[node.value] = node
    
    def add_edge(self, source: Node, target: Node, value: LayoutStrategy):
        source.nexts.append(target)
        source.nexts_edges.append(value)
        target.prevs.append(source)
        target.prevs_edges.append(value)
    
    def remove_edge(self, source: Node, target: Node):
        source_idx = source.nexts.index(target)
        target_idx = target.prevs.index(source)
        source.nexts.pop(source_idx)
        source.nexts_edges.pop(source_idx)
        target.prevs.pop(target_idx)
        target.prevs_edges.pop(target_idx)
    
    def add_edge_by_value(self, source: LayoutElement, target: LayoutElement, value: LayoutStrategy):
        source_node = self.node_map[source]
        target_node = self.node_map[target]
        self.add_edge(source_node, target_node, value)
    
    def add_node_with_edges(self, source: LayoutElement, target: LayoutElement, value: LayoutStrategy):
        self.add_node(Node(source))
        source_node = self.node_map[source]
        target_node = self.node_map[target]
        flip = False
        for prev, prev_value in zip(target_node.prevs, target_node.prevs_edges):
            if prev_value.name == value.name and prev_value.direction == value.direction:
                # 把关系转移到prev到node之间
                self.add_edge(prev, source_node, prev_value)
                self.remove_edge(prev, target_node)
        for next, next_value in zip(target_node.nexts, target_node.nexts_edges):
            if next_value.name == value.name and next_value.direction != value.direction:
                # 把关系转移到node到next之间
                self.add_edge(source_node, next, next_value)
                self.remove_edge(target_node, next)
                flip = True
        if not flip:
            self.add_edge_by_value(source, target, value)
        else:
            if value.direction == 'left' or value.direction == 'right':
                value.direction = 'right' if value.direction == 'left' else 'left'
            else:
                value.direction = 'down' if value.direction == 'up' else 'up'
            self.add_edge_by_value(target, source, value)
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
        
        # print("G.nodes:", G.nodes)
        # print("G.edges:", G.edges)
        # print("G.edge_labels:", edge_labels)
        # print("G.pos:", pos)
        # # 确保图形完全渲染
        # plt.tight_layout()
                
        # 保存图形