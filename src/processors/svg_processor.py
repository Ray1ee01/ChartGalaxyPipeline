from ..interfaces.base import SVGProcessor
from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from ..utils.node_bridge import NodeBridge
import os
import json
import base64
import requests
from urllib.parse import urlparse
import mimetypes

default_additional_configs = {
    "iconAttachConfig": {
        "method": "juxtaposition",
        "attachTo": "y-axis",
        "iconUrls": [],
        "attachToMark": {
            "sizeRatio": 1,
            "padding": 0,
            "relative": ["start", "inner"] # 相对于mark的位置 可能的取值有 ["start", "inner"], ["end", "inner"], ["end", "outer"], ["middle", "inner"]
        },
        "attachToAxis": {
            "padding": 0
        }
    },
    "titleConfig": {
        "title": {
            "text": ["The Countries With The Highest","Density Of Robot Workers"],
            "fontSize": 12,
            "fontFamily": "sans-serif",
            "fontWeight": "bold",
            "color": "#000000",
            "textAnchor": "left",
        },
        "subtitle": {
            "text": ["Installed industrial robots per 10,000 employees in","the manufacturing industry in 2019*"],
            "fontSize": 12,
            "fontFamily": "sans-serif",
            "fontWeight": "normal",
            "color": "#808080",
            "textAnchor": "left"
        }
    },
    "topicIconConfig": {
        "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm.png"
    },
    "floatIconConfig": {
        "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm.png",
        "size": 50,  # 图标大小
        "padding": 10,  # 与其他元素的最小间距
        "preferredArea": "bottom-right"  # 优先查找区域: top-right, top-left, bottom-right, bottom-left
    },
    # there are three elements to be layout: chart, title->{title, subtitle} and topicIcon
    "layoutConfig": {
        # first the global layout is defined by a layout tree, and nodes in the same level are specified by layout rules
        "layoutTree": {
            "tag": "root",
            "layoutRules": {
                "layoutType": "vertical",
                "padding": 10,
                "verticalAlign": "middle", # middle, top, bottom
                "horizontalAlign": "middle" # middle, left, right
            },
            "children": [
                {
                    "tag": "chart",
                    "children": []
                },
                {
                    "tag": "global_title_group",
                    "layoutRules": {
                        "layoutType": "horizontal",
                        "padding": 0,
                        "verticalAlign": "top", # top, middle, bottom
                        "horizontalAlign": "middle" # left, middle, right
                    },
                    "children": [
                        {
                            "tag": "title_group",
                            "layoutRules": {
                                "layoutType": "vertical",
                                "padding": 10,
                                "verticalAlign": "middle", # top, middle, bottom
                                "horizontalAlign": "left" # left, middle, right
                            },
                            "children": [
                                {
                                    "tag": "title_text",
                                    "children": []
                                },
                                {
                                    "tag": "subtitle_text",
                                    "children": []
                                }
                            ]
                        },
                        # {
                        #     "tag": "topic_icon",
                        #     "children": []
                        # }
                    ]
                },
            ]
        }
    }
}

class SVGOptimizer(SVGProcessor):
    def __init__(self):
        self.node_bridge = NodeBridge()
        # 获取当前文件所在目录
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # 构建measure_text.js的路径
        self.measure_script_path = os.path.join(current_dir, 'svg_processor_modules', 'text_tool', 'measure_text.js')

    def process(self, svg: str, additional_configs: Dict, debug: bool = False) -> Union[dict, str]:
        """处理SVG
        
        Args:
            svg: SVG字符串
            additional_configs: 额外的配置信息
            debug: 是否返回中间结果用于调试
        
        Returns:
            Union[dict, str]: 如果debug为True，返回处理后的树结构；否则返回处理后的SVG字符串
        """
        # 丢弃svg中所有tag为rect且fill为#ffffff的rect
        svg = re.sub(r'<rect[^>]*fill="#ffffff"[^>]*>', '', svg)
        
        return svg
        # 解析SVG为树结构
        tree = self.parseTree(svg)
        if not tree:
            return svg
        
        # 添加边界框信息
        self._addBBoxToTree(tree)
        
        # 查找坐标轴和marks
        axes = self._findAxes(tree)
        marks = self._findMarks(tree)
        total_configs = {**default_additional_configs, **additional_configs}
        
        # 处理icon附加
        if total_configs.get("iconAttachConfig"):
            self._processIconAttachment(tree, total_configs["iconAttachConfig"], axes, marks)
        
        
        # 处理整体布局（包括标题、副标题、主题图标等）
        if any(key in total_configs for key in ['titleConfig', 'topicIconConfig', 'layoutConfig']):
            self._processLayout(tree, total_configs)
        
        # 添加浮动图标
        if total_configs.get("floatIconConfig"):
            self._processFloatIcon(tree, total_configs["floatIconConfig"])
        
        # print(tree)
        # 返回结果
        if debug:
            return tree
        return self._treeToSVG(tree)

    def _treeToSVG(self, node: dict) -> str:
        """将树结构转换回SVG字符串
        
        Args:
            node: 树节点
            
        Returns:
            str: SVG字符串
        """
        # 获取标签名
        tag = node['tag']
        
        # 构建属性字符串
        attrs = []
        for key, value in node.get('attributes', {}).items():
            # 处理特殊字符
            value = str(value).replace('"', '&quot;')
            attrs.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs)
        
        # 处理文本内容
        text_content = node.get('text', '')
        
        # 处理子节点
        children_content = []
        for child in node.get('children', []):
            children_content.append(self._treeToSVG(child))
        children_str = '\n'.join(children_content)
        
        # 构建完整的标签
        if children_content or text_content:
            # 如果有子节点或文本内容，使用开闭标签
            content = text_content + '\n' + children_str if text_content else children_str
            return f"<{tag} {attrs_str}>{content}</{tag}>"
        else:
            # 如果是空标签，使用自闭合形式
            return f"<{tag} {attrs_str}/>"

    def _addBBoxToTree(self, node: dict, parent_transform: List[float] = None) -> None:
        """递归地为树中的每个节点添加边界框
        
        Args:
            node: 当前节点
            parent_transform: 父节点的变换矩阵
        """
        # 获取当前节点的变换
        current_transform = None
        if 'attributes' in node and 'transform' in node['attributes']:
            current_transform = self._parseTransform(node['attributes']['transform'])
        
        # 如果有父节点的变换，将其应用到当前节点
        if parent_transform:
            # 移除当前节点的transform属性，因为它已经被包含在计算中
            # if 'transform' in node['attributes']:
            #     del node['attributes']['transform']
            
            # 获取当前节点的边界框
            bbox = self.getBBox(node)
            if bbox:
                # 应用父节点的变换
                node['bbox'] = self._applyTransform(
                    bbox['minX'], bbox['minY'],
                    bbox['maxX'], bbox['maxY'],
                    parent_transform
                )
        else:
            # 如果没有父节点变换，直接获取边界框
            bbox = self.getBBox(node)
            if bbox:
                node['bbox'] = bbox
        
        # 计算传递给子节点的变换矩阵
        transform_for_children = None
        if current_transform and parent_transform:
            if isinstance(current_transform, list) and len(current_transform) == 2:
                # 如果是双矩阵变换，需要特殊处理
                transform_for_children = [
                    self._combineTransforms(parent_transform, current_transform[0]),
                    current_transform[1]
                ]
            else:
                # 组合当前变换和父节点变换
                transform_for_children = self._combineTransforms(parent_transform, current_transform)
        elif current_transform:
            transform_for_children = current_transform
        elif parent_transform:
            transform_for_children = parent_transform
        
        # 递归处理子节点
        if 'children' in node:
            for child in node['children']:
                self._addBBoxToTree(child, transform_for_children)

    def parseTree(self, svg: str) -> dict:
        # 创建解析器
        parser = etree.XMLParser(remove_comments=True, remove_blank_text=True)
        # 将SVG字符串解析为XML树
        tree = etree.parse(StringIO(svg), parser)
        root = tree.getroot()
        
        # 递归解析节点
        return self._parse_node(root)
    
    def _parse_node(self, node) -> dict:
        # 创建基本节点信息
        result = {
            'tag': node.tag.split('}')[-1],  # 移除命名空间
            'attributes': dict(node.attrib),
            'children': []
        }
        
        # 如果节点有文本内容，添加到结果中
        if node.text and node.text.strip():
            result['text'] = node.text.strip()
            
        # 递归处理所有子节点
        for child in node:
            result['children'].append(self._parse_node(child))
            
        return result
        
    def getBBox(self, node: dict) -> Optional[Dict[str, float]]:
        """获取节点的边界框"""
        tag = node['tag']
        
        if tag == 'g' or tag == 'svg':
            return self._getBBoxGroup(node)
        elif tag == 'rect':
            return self._getBBoxRect(node)
        elif tag == 'circle':
            return self._getBBoxCircle(node)
        elif tag == 'text':
            return self._getBBoxText(node)
        elif tag == 'path':
            return self._getBBoxPath(node)
        elif tag == 'line':
            return self._getBBoxLine(node)
        elif tag == 'image':
            return self._getBBoxImage(node)
        return None

    def _parseTransform(self, transform: str) -> List[float]:
        """解析transform属性"""
        if not transform:
            return [1, 0, 0, 1, 0, 0]

        # 初始变换矩阵
        matrix = [1, 0, 0, 1, 0, 0]
        matrix2 = [1, 0, 0, 1, 0, 0]

        # 匹配所有translate和rotate
        translate_matches = list(re.finditer(r'translate\(([^,]+),?([^)]+)?\)', transform))
        rotate_match = re.search(r'rotate\(([^,]+)(?:,\s*([^,]+),\s*([^,]+))?\)', transform)

        # 处理多个translate
        if len(translate_matches) > 1:
            for match in translate_matches:
                tx = float(match.group(1))
                ty = float(match.group(2)) if match.group(2) else 0
                if rotate_match:
                    matrix2[4] += tx
                    matrix2[5] += ty
                else:
                    matrix[4] += tx
                    matrix[5] += ty
        else:
            # 处理单个translate
            translate_match = re.search(r'translate\(([^,]+),?([^)]+)?\)', transform)
            if translate_match:
                tx = float(translate_match.group(1))
                ty = float(translate_match.group(2)) if translate_match.group(2) else 0
                if rotate_match:
                    # 检查旋转中心点
                    cx = float(rotate_match.group(2)) if rotate_match.group(2) else 0
                    cy = float(rotate_match.group(3)) if rotate_match.group(3) else 0
                    if cx != 0 or cy != 0:
                        matrix2[4] += tx
                        matrix2[5] += ty
                    else:
                        matrix[4] += tx
                        matrix[5] += ty
                else:
                    matrix[4] += tx
                    matrix[5] += ty

        # 处理rotate
        if rotate_match:
            angle = -float(rotate_match.group(1)) * (math.pi / 180)
            cos = math.cos(angle)
            sin = math.sin(angle)
            
            # 检查旋转中心点
            cx = float(rotate_match.group(2)) if rotate_match.group(2) and not math.isnan(float(rotate_match.group(2))) else 0
            cy = float(rotate_match.group(3)) if rotate_match.group(3) and not math.isnan(float(rotate_match.group(3))) else 0

            if cx != 0 or cy != 0:
                matrix[0] = cos
                matrix[1] = -sin
                matrix[2] = sin
                matrix[3] = cos
                matrix[4] -= cx
                matrix[5] -= cy
                matrix2[4] += cx
                matrix2[5] += cy
                return [matrix, matrix2]
            else:
                matrix[0] = cos
                matrix[1] = -sin
                matrix[2] = sin
                matrix[3] = cos

        return matrix

    def _applyMatrix(self, x: float, y: float, matrix: List[float]) -> Tuple[float, float]:
        """应用变换矩阵到单个坐标点"""
        return (
            matrix[0] * (x + matrix[4]) + matrix[2] * (y + matrix[5]),
            matrix[1] * (x + matrix[4]) + matrix[3] * (y + matrix[5])
        )

    def _applyTransform(self, minX: float, minY: float, maxX: float, maxY: float, matrix: List[float]) -> Dict[str, float]:
        """应用变换到边界框的四个角点"""
        # 计算所有四个角点的变换后坐标
        nx1, ny1 = self._applyMatrix(minX, minY, matrix)  # 左上
        nx2, ny2 = self._applyMatrix(maxX, maxY, matrix)  # 右下
        nx3, ny3 = self._applyMatrix(minX, maxY, matrix)  # 左下
        nx4, ny4 = self._applyMatrix(maxX, minY, matrix)  # 右上
        
        # 找出变换后的最小和最大坐标
        new_min_x = min(nx1, nx2, nx3, nx4)
        new_min_y = min(ny1, ny2, ny3, ny4)
        new_max_x = max(nx1, nx2, nx3, nx4)
        new_max_y = max(ny1, ny2, ny3, ny4)
        
        return {
            'minX': new_min_x,
            'minY': new_min_y,
            'maxX': new_max_x,
            'maxY': new_max_y
        }

    def _getBBoxRect(self, node: Dict) -> Dict[str, float]:
        """获取矩形的边界框"""
        attrs = node['attributes']
        x = float(attrs.get('x', 0))
        y = float(attrs.get('y', 0))
        width = float(attrs.get('width', 0))
        height = float(attrs.get('height', 0))
        
        bbox = {'minX': x, 'minY': y, 'maxX': x + width, 'maxY': y + height}
        
        transform = attrs.get('transform')
        if transform:
            matrix = self._parseTransform(transform)
            if isinstance(matrix, list) and len(matrix) == 2:
                # 如果是两个矩阵，进行两次变换
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[0])
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[1])
            else:
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix)
        
        return bbox

    def _getBBoxCircle(self, node: Dict) -> Dict[str, float]:
        """获取圆形的边界框"""
        attrs = node['attributes']
        cx = float(attrs.get('cx', 0))
        cy = float(attrs.get('cy', 0))
        r = float(attrs.get('r', 0))
        
        transform = attrs.get('transform')
        if transform:
            matrix = self._parseTransform(transform)
            if isinstance(matrix, list) and len(matrix) == 2:
                bbox = self._applyTransform(cx - r, cy - r, cx + r, cy + r, matrix[0])
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[1])
                return bbox
            return self._applyTransform(cx - r, cy - r, cx + r, cy + r, matrix)
        
        return {
            'minX': cx - r,
            'minY': cy - r,
            'maxX': cx + r,
            'maxY': cy + r
        }

    def _getBBoxGroup(self, node: Dict, parent_text_anchor: str = None, parent_font_size: float = None) -> Dict[str, float]:
        """获取组的边界框"""
        if node['tag'] != 'g' and node['tag'] != 'svg':
            return None
        
        
        attrs = node['attributes']
        transform = attrs.get('transform')
        matrix = self._parseTransform(transform) if transform else None
        
        # 获取当前组的文本相关属性
        text_anchor = attrs.get('text-anchor', parent_text_anchor)
        font_size = float(attrs.get('font-size', parent_font_size)) if attrs.get('font-size') or parent_font_size else None
        
        # 获取所有子元素的边界框
        child_bboxes = []
        for child in node['children']:
            child_bbox = self.getBBox(child)
            if child_bbox:
                if matrix:
                    if isinstance(matrix, list) and len(matrix) == 2:
                        # 如果是两个矩阵，进行两次变换
                        bbox1 = self._applyTransform(
                            child_bbox['minX'], child_bbox['minY'],
                            child_bbox['maxX'], child_bbox['maxY'],
                            matrix[0]
                        )
                        child_bbox = self._applyTransform(
                            bbox1['minX'], bbox1['minY'],
                            bbox1['maxX'], bbox1['maxY'],
                            matrix[1]
                        )
                    else:
                        # 单个矩阵变换
                        child_bbox = self._applyTransform(
                            child_bbox['minX'], child_bbox['minY'],
                            child_bbox['maxX'], child_bbox['maxY'],
                            matrix
                        )
                child_bboxes.append(child_bbox)
        
        # 计算组的边界框
        if not child_bboxes:
            return {'minX': 0, 'minY': 0, 'maxX': 0, 'maxY': 0}
        
        minX = min(bbox['minX'] for bbox in child_bboxes)
        minY = min(bbox['minY'] for bbox in child_bboxes)
        maxX = max(bbox['maxX'] for bbox in child_bboxes)
        maxY = max(bbox['maxY'] for bbox in child_bboxes)
        
        return {'minX': minX, 'minY': minY, 'maxX': maxX, 'maxY': maxY}

    def _measureText(self, text: str, font_size: float, anchor: str = 'left top') -> Dict[str, float]:
        """使用Node.js的TextToSVG库测量文本尺寸"""
        try:
            data = {
                'text': text,
                'fontSize': font_size,
                'anchor': anchor
            }
            result = self.node_bridge.execute_node_script(
                self.measure_script_path,
                data
            )
            # print(result)
            metrics = json.loads(result)
            return metrics
        except Exception as e:
            print(f"测量文本时出错: {e}")
            # 回退到估算方法
            return {
                'width': len(text) * font_size * 0.6,
                'height': font_size * 1.2,
                'ascent': font_size,
                'descent': 0
            }

    def _parseLength(self, value: str, font_size: float = None) -> float:
        """解析单位的长度值"""
        if not value:
            return 0
        
        # 移除所有空白字符
        value = value.strip()
        
        # 处理带px单位的值
        if value.endswith('px'):
            return float(value[:-2])
        # 处理带em单位的值
        elif value.endswith('em'):
            if font_size is None:
                font_size = 16
            return float(value[:-2]) * font_size
        # 尝试直接转换为浮点数
        try:
            return float(value)
        except ValueError:
            return 0

    def _getBBoxText(self, node: Dict, parent_text_anchor: str = None, parent_font_size: float = None) -> Dict[str, float]:
        """获取文本的边界框"""
        attrs = node['attributes']
        text = node.get('text', '')
        
        x = float(attrs.get('x', 0))
        y = float(attrs.get('y', 0))
        dx = float(attrs.get('dx', 0))
        dy = float(attrs.get('dy', 0))
        
        # 使用_parseLength处理font-size
        raw_font_size = attrs.get('font-size')
        if raw_font_size and type(raw_font_size) == str:
            font_size = self._parseLength(raw_font_size)
        elif raw_font_size and (type(raw_font_size) == int or type(raw_font_size) == float):
            font_size = raw_font_size
        else:
            font_size = parent_font_size if parent_font_size else 16
        
        text_anchor = attrs.get('text-anchor', parent_text_anchor) or 'start'
        
        metrics = self._measureText(text, font_size)
        width = metrics['width']
        height = metrics['height']
        
        # 根据text-anchor调整x位置
        if text_anchor == 'middle':
            x -= width / 2
        elif text_anchor == 'end':
            x -= width
        
        x += dx
        y += dy - metrics['ascent']
        
        bbox = {'minX': x, 'minY': y, 'maxX': x + width, 'maxY': y + height}
        
        transform = attrs.get('transform')
        if transform:
            matrix = self._parseTransform(transform)
            if isinstance(matrix, list) and len(matrix) == 2:
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[0])
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[1])
            else:
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix)
        
        return bbox
        
    def _getBBoxPath(self, node: Dict) -> Dict[str, float]:
        """获取路径元素的边界框"""
        attrs = node['attributes']
        d = attrs.get('d', '')
        if not d:
            return {'minX': 0, 'minY': 0, 'maxX': 0, 'maxY': 0}
            
        commands = self._parsePath(d)
        # print("commands", commands)
        
        minX = float('inf')
        minY = float('inf')
        maxX = float('-inf')
        maxY = float('-inf')
        
        current_x = 0
        current_y = 0
        
        for cmd in commands:
            command = cmd['command']
            points = cmd['points']
            
            if command == 'M' or command == 'm': 
                current_x = points[0]
                current_y = points[1]
                minX = min(minX, current_x)
                minY = min(minY, current_y)
                maxX = max(maxX, current_x)
                maxY = max(maxY, current_y)
                
            elif command == 'L' or command == 'l':
                current_x = points[0]
                current_y = points[1]
                minX = min(minX, current_x)
                minY = min(minY, current_y)
                maxX = max(maxX, current_x)
                maxY = max(maxY, current_y)
                
            elif command == 'H' or command == 'h':
                current_x += points[0]
                minX = min(minX, current_x)
                maxX = max(maxX, current_x)
                
            elif command == 'V' or command == 'v':
                current_y += points[0]
                minY = min(minY, current_y)
                maxY = max(maxY, current_y)
                
            elif command == 'C':  # 三次贝塞尔曲线
                # 控制点和终点都可能影响边界框
                for i in range(0, len(points), 2):
                    x, y = points[i], points[i+1]
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                current_x = points[-2]
                current_y = points[-1]
        
        # 处理变换
        transform = attrs.get('transform')
        if transform:
            matrix = self._parseTransform(transform)
            if isinstance(matrix, list) and len(matrix) == 2:
                bbox = self._applyTransform(
                    minX if minX != float('inf') else 0,
                    minY if minY != float('inf') else 0,
                    maxX if maxX != float('-inf') else 0,
                    maxY if maxY != float('-inf') else 0,
                    matrix[0]
                )
                return self._applyTransform(
                    bbox['minX'], bbox['minY'],
                    bbox['maxX'], bbox['maxY'],
                    matrix[1]
                )
            return self._applyTransform(
                minX if minX != float('inf') else 0,
                minY if minY != float('inf') else 0,
                maxX if maxX != float('-inf') else 0,
                maxY if maxY != float('-inf') else 0,
                matrix
            )
        
        return {
            'minX': minX if minX != float('inf') else 0,
            'minY': minY if minY != float('inf') else 0,
            'maxX': maxX if maxX != float('-inf') else 0,
            'maxY': maxY if maxY != float('-inf') else 0
        }
        
    def _parsePath(self, d: str) -> List[Dict]:
        """解析SVG路径的'd'属性"""
        commands = []
        # 匹配命令字母和后面的数字
        pattern = r'([a-zA-Z])([^a-zA-Z]*)'
        matches = re.finditer(pattern, d)
        
        for match in matches:
            command = match.group(1)
            # 将数字字符串分割并转换为浮点数
            points_str = match.group(2).strip()
            # 同时处理空格和逗号作为分隔符
            points = [float(p) for p in re.split(r'[\s,]+', points_str) if p]
            commands.append({
                'command': command,
                'points': points
            })
        
        return commands
        
    def _getBBoxLine(self, node: Dict) -> Dict[str, float]:
        """获取线段的边界框"""
        attrs = node['attributes']
        x1 = float(attrs.get('x1', 0))
        y1 = float(attrs.get('y1', 0))
        x2 = float(attrs.get('x2', 0))
        y2 = float(attrs.get('y2', 0))
        stroke_width = float(attrs.get('stroke-width', 1))
        if x1==x2:
            x1 -= stroke_width / 2
            x2 += stroke_width / 2
        if y1==y2:
            y1 -= stroke_width / 2
            y2 += stroke_width / 2
        
        transform = attrs.get('transform')
        if transform:
            matrix = self._parseTransform(transform)
            if isinstance(matrix, list) and len(matrix) == 2:
                # 如果是两个矩阵，进行两次变换
                bbox = self._applyTransform(x1, y1, x2, y2, matrix[0])
                bbox = self._applyTransform(
                    bbox['minX'], bbox['minY'],
                    bbox['maxX'], bbox['maxY'],
                    matrix[1]
                )
                return bbox
            else:
                return self._applyTransform(x1, y1, x2, y2, matrix)
        
        # 如果没有变换，直接返回线段的边界框
        return {
            'minX': min(x1, x2),
            'minY': min(y1, y2),
            'maxX': max(x1, x2),
            'maxY': max(y1, y2)
        }
        
    def debug_draw_bbox(self, svg: str) -> str:
        """在SVG中绘制所有叶子节点的边界框
        
        Args:
            svg: 原始SVG字符串
        
        Returns:
            str: 添加了边界框可视化的SVG字符串
        """
        # 首先解析SVG并获取边界框
        tree = self.parseTree(svg)
        self._addBBoxToTree(tree)
        
        # 找到所有叶子节点并收集它们的边界框
        leaf_bboxes = []
        self._collect_leaf_bboxes(tree, leaf_bboxes)
        
        # 在SVG末尾（但在</svg>之前）添加边界框矩形
        svg_parts = svg.rsplit('</svg>', 1)
        if len(svg_parts) != 2:
            return svg
        
        # 创建一个调试组来容纳所有边界框
        debug_group = '<g id="debug-bboxes" style="fill:none;stroke:red;stroke-width:1;opacity:0.5">'
        
        # 为每个边界框创建矩形
        for node_info in leaf_bboxes:
            bbox = node_info['bbox']
            tag = node_info['tag']
            if tag != 'text':
                continue
            debug_group += f'''
                <rect 
                    x="{bbox['minX']}" 
                    y="{bbox['minY']}" 
                    width="{bbox['maxX'] - bbox['minX']}" 
                    height="{bbox['maxY'] - bbox['minY']}"
                />
                <text 
                    x="{bbox['minX']}" 
                    y="{bbox['minY'] - 5}" 
                    style="fill:red;font-size:10px"
                >{tag}</text>
            '''
        
        debug_group += '</g>'
        
        # 将调试组添加到SVG中
        return f"{svg_parts[0]}{debug_group}</svg>"

    def _collect_leaf_bboxes(self, node: dict, result: list) -> None:
        """递归收集所有叶子节点的边界框
        
        Args:
            node: 当前节点
            result: 收集结果的列表
        """
        # 检查是否是叶子节点（没有子节点或子节点为空）
        is_leaf = 'children' not in node or not node['children']
        
        if is_leaf and 'bbox' in node:
            result.append({
                'tag': node['tag'],
                'bbox': node['bbox'],
                'attributes': node['attributes']
            })
        elif 'children' in node:
            for child in node['children']:
                self._collect_leaf_bboxes(child, result)
        
    def _combineTransforms(self, transform1: List[float], transform2: List[float]) -> List[float]:
        """组合两个变换矩阵
        
        Args:
            transform1: 第一个变换矩阵 [a1, b1, c1, d1, e1, f1]
            transform2: 第二个变换矩阵 [a2, b2, c2, d2, e2, f2]
        
        Returns:
            List[float]: 组合后的变换矩阵 [a, b, c, d, e, f]
        """
        # 矩阵乘法：
        # [a1 c1 e1]   [a2 c2 e2]   [a1*a2+c1*b2   a1*c2+c1*d2   a1*e2+c1*f2+e1]
        # [b1 d1 f1] * [b2 d2 f2] = [b1*a2+d1*b2   b1*c2+d1*d2   b1*e2+d1*f2+f1]
        # [0  0  1 ]   [0  0  1 ]   [0             0             1               ]
        
        a1, b1, c1, d1, e1, f1 = transform1
        a2, b2, c2, d2, e2, f2 = transform2
        
        return [
            a1 * a2 + c1 * b2,      # a
            b1 * a2 + d1 * b2,      # b
            a1 * c2 + c1 * d2,      # c
            b1 * c2 + d1 * d2,      # d
            a1 * e2 + c1 * f2 + e1, # e
            b1 * e2 + d1 * f2 + f1  # f
        ]
        
    def _findAxes(self, node: dict) -> Dict[str, dict]:
        """查找SVG中的轴及其组件
        
        Returns:
            Dict: 包含轴及其组件信息的字典
        """
        axes = {
            'x_axis': {'main': None, 'ticks': None, 'labels': None, 'domain': None},
            'y_axis': {'main': None, 'ticks': None, 'labels': None, 'domain': None}
        }
        
        def search_axis_components(node, axis_info):
            """搜索轴的组件"""
            if not node.get('children'):
                return
            
            for child in node['children']:
                class_attr = child.get('attributes', {}).get('class', '')
                
                if 'mark-rule role-axis-tick' in class_attr:
                    axis_info['ticks'] = child
                elif 'mark-text role-axis-label' in class_attr:
                    axis_info['labels'] = child
                elif 'mark-rule role-axis-domain' in class_attr:
                    axis_info['domain'] = child
                
                # 递归搜索
                search_axis_components(child, axis_info)
        
        def search_axes(node):
            if node.get('tag') == 'g' and \
               node.get('attributes', {}).get('class') == 'mark-group role-axis' and \
               node.get('attributes', {}).get('aria-roledescription') == 'axis':
                
                aria_label = node.get('attributes', {}).get('aria-label', '')
                if 'X-axis' in aria_label:
                    axes['x_axis']['main'] = node
                    search_axis_components(node, axes['x_axis'])
                elif 'Y-axis' in aria_label:
                    axes['y_axis']['main'] = node
                    search_axis_components(node, axes['y_axis'])
            
            # 递归搜索子节点
            for child in node.get('children', []):
                search_axes(child)
        
        search_axes(node)
        return axes
        
    def _findMarks(self, node: dict) -> List[dict]:
        """查找SVG中的marks组
        
        Returns:
            List[dict]: 包含所有找到的marks组的列表
        """
        marks = {
            'rect_marks': None,
            'annotation_marks': None,
            'other_marks': []
        }
        
        def search_marks(node):
            if node.get('tag') == 'g' and \
               node.get('attributes', {}).get('role') == 'graphics-object' and \
               node.get('attributes', {}).get('aria-roledescription', '').endswith('mark container'):
                
                # 检查是否是矩形标记组
                if 'rect' in node.get('attributes', {}).get('aria-roledescription', '').lower():
                    marks['rect_marks'] = node
                elif 'text' in node.get('attributes', {}).get('aria-roledescription', '').lower():
                    marks['annotation_marks'] = node
                else:
                    marks['other_marks'].append(node)
            
            # 递归搜索子节点
            for child in node.get('children', []):
                search_marks(child)
        
        search_marks(node)
        return marks
        
    def _processIconAttachment(self, tree: dict, icon_config: dict, axes: dict, marks: dict) -> None:
        """处理图标附加到图表的逻辑"""
        if icon_config["method"] != "juxtaposition":
            return
        
        if icon_config["attachTo"] == "y-axis":
            y_axis = axes["y_axis"]
            if not y_axis['main']:
                return
            
            # 获取y轴标签信息
            labels_info = self._getAxisLabelsInfo(y_axis['labels'])
            if not labels_info:
                return
            
            # 获取必要的边界框信息
            axis_bbox = y_axis['main'].get("bbox", {})
            domain_bbox = y_axis['domain'].get("bbox", {}) if y_axis['domain'] else None
            ticks_bbox = y_axis['ticks'].get("bbox", {}) if y_axis['ticks'] else None
            
            if not axis_bbox or not domain_bbox or not ticks_bbox:
                return
            
            # 判断标签相对于轴的方向
            labels_direction = self._determineLabelsDirection(labels_info, domain_bbox)
            
            # 计算图标位置和大小
            icon_positions = self._calculateIconPositions(
                labels_info,
                domain_bbox,
                labels_direction,
                icon_config,
                ticks_bbox,
                "y"  # 添加轴方向参数
            )
            
            # 添加图标到SVG
            self._addIconsToSVG(tree, icon_positions, icon_config["iconUrls"])
        
        elif icon_config["attachTo"] == "x-axis":
            x_axis = axes["x_axis"]
            if not x_axis['main']:
                return
            
            # 获取x轴标签信息
            labels_info = self._getAxisLabelsInfo(x_axis['labels'])
            if not labels_info:
                return
            
            # 获取必要的边界框信息
            axis_bbox = x_axis['main'].get("bbox", {})
            domain_bbox = x_axis['domain'].get("bbox", {}) if x_axis['domain'] else None
            ticks_bbox = x_axis['ticks'].get("bbox", {}) if x_axis['ticks'] else None
            
            if not axis_bbox or not domain_bbox or not ticks_bbox:
                return
            
            # 判断标签���对于轴的方向
            labels_direction = self._determineLabelsDirection(labels_info, domain_bbox)
            
            # 计算图标位置和大小
            icon_positions = self._calculateIconPositions(
                labels_info,
                domain_bbox,
                labels_direction,
                icon_config,
                ticks_bbox,
                "x"  # 添加轴方向参数
            )
            
            # 添加图标到SVG
            self._addIconsToSVG(tree, icon_positions, icon_config["iconUrls"])
        elif icon_config["attachTo"] == "mark":
            if not marks.get('rect_marks'):
                return
            
            # 获取mark的方向和参考大小
            mark_orientation = self._determineMarkOrientation(marks['rect_marks'])
            reference_size = self._getMarkReferenceSize(marks['rect_marks'], mark_orientation)
            
            # 计算图标位置
            icon_positions = self._calculateMarkIconPositions(
                marks['rect_marks'],
                marks['annotation_marks'],
                mark_orientation,
                reference_size,
                icon_config
            )
            # 添加图标到SVG
            self._addIconsToSVG(tree, icon_positions, icon_config["iconUrls"])

    def _getAxisLabelsInfo(self, labels_group: dict) -> List[Dict]:
        """获取轴标签信息"""
        labels_info = []
        
        if not labels_group or 'children' not in labels_group:
            return labels_info
        
        for child in labels_group['children']:
            if child['tag'] == 'text' and 'bbox' in child:
                labels_info.append({
                    'node': child,
                    'text': child.get('text', ''),
                    'bbox': child['bbox'],
                    'original_x': float(child['attributes'].get('x', 0)),
                    'original_y': float(child['attributes'].get('y', 0))
                })
        
        return labels_info

    def _determineLabelsDirection(self, labels_info: List[Dict], domain_bbox: Dict) -> str:
        """确定标签相对于轴的方向"""
        if not labels_info:
            return "right"
        
        # 获取第一个标签的位置
        first_label = labels_info[0]
        domain_center_x = (domain_bbox['minX'] + domain_bbox['maxX']) / 2
        
        # 如果标签在轴的左边
        if first_label['bbox']['maxX'] < domain_center_x:
            return "left"
        # 如果标签在轴的右边
        else:
            return "right"

    def _calculateIconPositions(self, labels_info: List[Dict], domain_bbox: Dict, 
                              labels_direction: str, icon_config: Dict, ticks_bbox: Dict,
                              axis_type: str) -> List[Dict]:
        """计算图标的位置和大小
        
        Args:
            labels_info: 标签信息列表
            domain_bbox: 轴域的边界框
            labels_direction: 标签方向
            icon_config: 图标配置
            ticks_bbox: 刻度线的边界框
            axis_type: 轴类型 ('x' 或 'y')
        """
        icon_positions = []
        
        # 获取配置参数
        size_ratio = icon_config.get("attachToAxis", {}).get("sizeRatio", 2)
        padding = icon_config.get("attachToAxis", {}).get("padding", 0)
        
        if axis_type == "y":
            # Y轴的处理逻辑（保持原有逻辑）
            axis_x = min(domain_bbox['minX'], ticks_bbox['minX'])
            
            for label in labels_info:
                icon_height = (label['bbox']['maxY'] - label['bbox']['minY']) * size_ratio
                icon_width = icon_height
                
                icon_y = (label['bbox']['minY'] + label['bbox']['maxY'] - icon_height) / 2
                icon_x = axis_x - padding - icon_width
                
                original_x = label['bbox']['maxX']
                target_x = icon_x - padding
                dx = target_x - original_x
                
                current_transform = label['node']['attributes'].get('transform', '')
                new_transform = f'translate({dx},0)'
                if current_transform:
                    new_transform = f'{current_transform} {new_transform}'
                label['node']['attributes']['transform'] = new_transform
                
                icon_positions.append({
                    'x': icon_x,
                    'y': icon_y,
                    'width': icon_width,
                    'height': icon_height,
                    'label': label
                })
        
        else:  # axis_type == "x"
            # X轴的处理逻辑
            axis_y = max(domain_bbox['maxY'], ticks_bbox['maxY'])
            
            for label in labels_info:
                # 计算图标宽度（基于标签宽度）
                icon_width = (label['bbox']['maxX'] - label['bbox']['minX']) * size_ratio
                # 保持图标的宽高比为1:1
                icon_height = icon_width
                
                # 计算图标的x位置（水平居中对齐标签）
                icon_x = (label['bbox']['minX'] + label['bbox']['maxX'] - icon_width) / 2
                
                # 从上到下布局：标签 -> padding -> 图标
                icon_y = axis_y + padding
                
                # 计算标签需要移动的距离
                original_y = label['bbox']['minY']
                target_y = icon_y - padding - label['bbox']['height']
                dy = target_y - original_y
                
                # 通过transform调整标签位置
                current_transform = label['node']['attributes'].get('transform', '')
                new_transform = f'translate(0,{dy})'
                if current_transform:
                    new_transform = f'{current_transform} {new_transform}'
                label['node']['attributes']['transform'] = new_transform
                
                icon_positions.append({
                    'x': icon_x,
                    'y': icon_y,
                    'width': icon_width,
                    'height': icon_height,
                    'label': label
                })
        
        return icon_positions

    def _addIconsToSVG(self, tree: dict, icon_positions: List[Dict], icon_urls: List[str]) -> None:
        """将图标添加到SVG中，支持URL和base64编码"""
        # 确保有足够的图标URL
        if not icon_urls or not icon_positions:
            return
        
        # 创建一个新的组来容纳所有图标
        icons_group = {
            'tag': 'g',
            'attributes': {
                'class': 'icon-attachments'
            },
            'children': []
        }
        
        # 为每个位置添加图标
        for i, position in enumerate(icon_positions):
            if i >= len(icon_urls):
                break
            
            # 获取base64编码的图片数据
            image_data = self._getImageAsBase64(icon_urls[i])
            if not image_data:
                continue
            
            icon = {
                'tag': 'image',
                'attributes': {
                    'x': str(position['x']),
                    'y': str(position['y']),
                    'width': str(position['width']),
                    'height': str(position['height']),
                    'href': f"data:{image_data}",
                    'preserveAspectRatio': 'xMidYMid meet'
                }
            }
            icons_group['children'].append(icon)
        
        # 将图标组添加到SVG树中
        if 'children' not in tree:
            tree['children'] = []
        tree['children'].append(icons_group)

    def _getImageAsBase64(self, image_url: str) -> Optional[str]:
        """将图片转换为base64编码
        
        Args:
            image_url: 图片URL或本地文件路径
        
        Returns:
            Optional[str]: base64编码的图片数据，包含MIME类型
        """
        try:
            # 检查是否已经是base64编码
            if image_url.startswith('data:'):
                return image_url
            
            # 判断是URL还是本地文件
            parsed = urlparse(image_url)
            is_url = bool(parsed.scheme and parsed.netloc)
            
            # 获取图片数据
            if is_url:
                response = requests.get(image_url)
                image_data = response.content
                # 从URL或Content-Type获取MIME类型
                content_type = response.headers.get('content-type')
                if not content_type:
                    content_type = mimetypes.guess_type(image_url)[0] or 'image/png'
            else:
                # 处理本地文件
                with open(image_url, 'rb') as f:
                    image_data = f.read()
                content_type = mimetypes.guess_type(image_url)[0] or 'image/png'
            
            # 转换为base64
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"{content_type};base64,{base64_data}"
            
        except Exception as e:
            print(f"Error processing image {image_url}: {str(e)}")
            return None

    def _determineMarkOrientation(self, mark_group: dict) -> str:
        """确定mark的朝向
        
        Args:
            mark_group: mark组节点
        
        Returns:
            str: 'left', 'right', 'up', 或 'down'
        """
        if not mark_group.get('children'):
            return 'right'  # 默认朝向
        
        # 收集所有矩形的位置信息
        rects = []
        for child in mark_group['children']:
            if child['tag'] == 'rect' and 'bbox' in child:
                bbox = child['bbox']
                center_x = (bbox['minX'] + bbox['maxX']) / 2
                center_y = (bbox['minY'] + bbox['maxY']) / 2
                rects.append({
                    'center_x': center_x,
                    'center_y': center_y,
                    'width': bbox['maxX'] - bbox['minX'],
                    'height': bbox['maxY'] - bbox['minY']
                })
        
        if len(rects) < 2:
            return 'right'  # 如果只有一个矩形，默认朝向
        
        # 计算相邻矩形之间的位置关系
        dx = rects[1]['center_x'] - rects[0]['center_x']
        dy = rects[1]['center_y'] - rects[0]['center_y']
        
        # 判断���要变化方���
        if abs(dx) > abs(dy):
            # 水平排列
            return 'right' if dx > 0 else 'left'
        else:
            # 垂直排列
            return 'down' if dy > 0 else 'up'

    def _getMarkReferenceSize(self, mark_group: dict, orientation: str) -> float:
        """获取mark的参考大小
        
        Args:
            mark_group: mark组节点
            orientation: mark的朝向
        
        Returns:
            float: 参考大小
        """
        if not mark_group.get('children'):
            return 0
        
        # 收集所有矩形的相关尺寸
        sizes = []
        for child in mark_group['children']:
            if child['tag'] == 'path' and 'bbox' in child:
                bbox = child['bbox']
                if orientation == 'right' or orientation == 'left':
                    sizes.append(bbox['maxY'] - bbox['minY'])  # 使用高度
                else:
                    sizes.append(bbox['maxX'] - bbox['minX'])  # 使用宽度
        # 返回平均大小
        return sum(sizes) / len(sizes) if sizes else 0

    def _calculateMarkIconPositions(self, mark_group: dict, annotation_group: dict, orientation: str, 
                              reference_size: float, icon_config: dict) -> List[Dict]:
        """计算mark图标的位置"""
        icon_positions = []
        
        # 获取配置
        size_ratio = icon_config.get("attachToMark", {}).get("sizeRatio", 1)
        padding = icon_config.get("attachToMark", {}).get("padding", 0)
        relative = icon_config.get("attachToMark", {}).get("relative", ["start", "inner"])
        
        # 计算图标大小
        icon_size = reference_size * size_ratio
        
        # 如果是end且outer，需要调整文本位置
        need_adjust_text = relative == ["end", "outer"]
        
        # 获取文本标注组

        # 获取所有需要处理的矩形
        rect_nodes = [child for child in mark_group.get('children', []) 
                    if child['tag'] == 'path' and 'bbox' in child]
        
        # 同时遍历矩形和对应的文本
        for i, rect in enumerate(rect_nodes):
            bbox = rect['bbox']
            position = self._calculateSingleMarkIconPosition(
                bbox,
                orientation,
                icon_size,
                padding,
                relative
            )
            
            if position:
                icon_positions.append(position)
                
                # 调整对应的文本位置
                if need_adjust_text and annotation_group and i < len(annotation_group.get('children', [])):
                    text = annotation_group['children'][i]
                    self._adjustAnnotationText(
                        text,
                        orientation,
                        icon_size,
                        padding
                    )
        
        return icon_positions

    def _adjustAnnotationText(self, text: Dict, orientation: str, 
                         icon_size: float, padding: float):
        """调整标注文本的位置
        
        Args:
            text: 文本节点
            orientation: mark的朝向
            icon_size: 图标大小
            padding: 内边距
        """
        # 计算需要移动的距离
        if orientation in ['left', 'right']:
            # 水平方向需要水平移动
            dx = icon_size + padding
            dy = 0
        else:
            # 垂直方向需要垂直移动
            dx = 0
            dy = icon_size + padding
            
        # 根据朝向确定移动方向
        if orientation == 'left':
            dx = -dx
        elif orientation == 'up':
            dy = -dy
            
        # 添加或更新transform
        current_transform = text['attributes'].get('transform', '')
        new_transform = f'translate({dx},{dy})'
        if current_transform:
            new_transform = f'{current_transform} {new_transform}'
        text['attributes']['transform'] = new_transform

    def _calculateSingleMarkIconPosition(self, bbox: Dict, orientation: str,
                                       icon_size: float, padding: float,
                                       relative: List[str]) -> Dict:
        """计算单个mark的图标位置
        
        Args:
            bbox: mark的边界框
            orientation: mark的朝向 ('left', 'right', 'up', 'down')
            icon_size: 图标大小
            padding: 内边距
            relative: 相对位置配置 ["start"/"end"/"middle", "inner"/"outer"]
        
        Returns:
            Dict: 图标位置信息
        """
        position_type, inner_outer = relative
        
        # 水平/垂直中心位置
        center_x = (bbox['minX'] + bbox['maxX']) / 2
        center_y = (bbox['minY'] + bbox['maxY']) / 2
        
        # 根据朝向确定start和end的实际含义
        if orientation in ['left', 'right']:
            # 水平方向的mark
            y = center_y - icon_size / 2  # 垂直居中
            
            if orientation == 'right':
                # 朝右时，start是左侧，end是右侧
                if position_type == "start":
                    x = bbox['minX'] + (padding if inner_outer == "inner" else -icon_size - padding)
                elif position_type == "end":
                    x = bbox['maxX'] - (icon_size + padding if inner_outer == "inner" else -padding)
                else:  # middle
                    x = center_x - icon_size / 2
            else:  # left
                # 朝左时，start是右侧，end是左侧
                if position_type == "start":
                    x = bbox['maxX'] - (icon_size + padding if inner_outer == "inner" else -padding)
                elif position_type == "end":
                    x = bbox['minX'] + (padding if inner_outer == "inner" else -icon_size - padding)
                else:  # middle
                    x = center_x - icon_size / 2
        else:
            # 垂直方向的mark
            x = center_x - icon_size / 2  # 水平居中
            
            if orientation == 'down':
                # 朝下时，start是上侧，end是下侧
                if position_type == "start":
                    y = bbox['minY'] + (padding if inner_outer == "inner" else -icon_size - padding)
                elif position_type == "end":
                    y = bbox['maxY'] - (icon_size + padding if inner_outer == "inner" else -padding)
                else:  # middle
                    y = center_y - icon_size / 2
            else:  # up
                # 朝上时，start是下侧，end是上侧
                if position_type == "start":
                    y = bbox['maxY'] - (icon_size + padding if inner_outer == "inner" else -padding)
                elif position_type == "end":
                    y = bbox['minY'] + (padding if inner_outer == "inner" else -icon_size - padding)
                else:  # middle
                    y = center_y - icon_size / 2
            
        return {
            'x': x,
            'y': y,
            'width': icon_size,
            'height': icon_size
        }

    def _processLayout(self, tree: dict, configs: Dict) -> None:
        """处理整体布局
        
        Args:
            tree: SVG树结构
            configs: 配置信息
        """
        # 1. 首先创建所有需要的元素
        chart_group = self._createChartGroup(tree)
        title_group = self._createTitleGroup(configs.get('titleConfig', {}))
        topic_icon = self._createTopicIcon(configs.get('topicIconConfig', {}))
        
        # 2. 按照布局树组织元素
        layout_tree = configs.get('layoutConfig', {}).get('layoutTree', {})
        # 把 layout_tree 的 children中的tag为'chart'的元素替换为chart_group
        for index, child in enumerate(layout_tree['children']):
            if child['tag'] == 'chart':
                layout_tree['children'][index] = chart_group
        # 把layout_tree中的tag为'title_group'的元素替换为title_group
        def replace_title_group(node):
            if node['tag'] == 'title_group':
                node['tag'] = 'g'
                node['attributes'] = {'class': 'title-group'}
                node['children'] = title_group['children']
                return
            for child in node.get('children', []):
                replace_title_group(child)
        replace_title_group(layout_tree)
        
        # 把layout_tree中tag为'topic_icon'的元素替换为topic_icon
        def replace_topic_icon(node):
            if node['tag'] == 'topic_icon':
                node['tag'] = 'image'
                node['attributes'] = topic_icon['attributes']
                node['children'] = []
                node['bbox'] = topic_icon['bbox']
                return
            for child in node.get('children', []):
                replace_topic_icon(child)
        replace_topic_icon(layout_tree)
            
        # 把layout_tree中tag为'global_title_group'的元素的tag替换为'g',增加attributes为{'class': 'global-title-group'}
        for child in layout_tree['children']:
            if child['tag'] == 'global_title_group':
                child['tag'] = 'g'
                child['attributes'] = {'class': 'global-title-group'}
                
        # for child in layout_tree['children']:
        #     print(child)
        # 创建新的根组
        new_root = {
            'tag': 'g',
            'attributes': {'class': 'root-group'},
            'children': []
        }
        
        # 3. 递归构建布局
        self._buildLayout(layout_tree, {
            'chart': chart_group,
            'title_text_group': title_group,
            'topic_icon': topic_icon
        }, new_root)
        
        # 4. 替换原始内容
        tree['children'] = [new_root]

    def _createChartGroup(self, tree: dict) -> dict:
        """将原始图表内容打包到一个组中"""
        return {
            'tag': 'g',
            'attributes': {'class': 'chart-group'},
            'children': tree.get('children', []).copy(),
            'bbox': tree.get('bbox', {}),
        }

    def _createTitleGroup(self, title_config: Dict) -> dict:
        """创建标题组（包含主标题和副标题组）
        
        Args:
            title_config: 标题配置信息
        """
        title_group = {
            'tag': 'g',
            'attributes': {'class': 'title-group'},
            'children': [],
            'bbox': {'minX': 0, 'minY': 0, 'maxX': 0, 'maxY': 0}
        }
        
        # 分别创建主标题和副标题组
        title_text_group = self._createTitleTextGroup(title_config.get('title', {}))
        subtitle_text_group = self._createSubtitleTextGroup(title_config.get('subtitle', {}))
        
        # 将两个组添加到标题组中
        if title_text_group:
            title_group['children'].append(title_text_group)
        if subtitle_text_group:
            title_group['children'].append(subtitle_text_group)
        
        return title_group

    def _createTitleTextGroup(self, title_config: Dict) -> Optional[dict]:
        """创建主标题组，支持多行文本
        
        Args:
            title_config: 主标题配置信息
        """
        text_content = title_config.get('text')
        if not text_content:
            return None
        
        # 将文本内容统一转换为列表形式
        text_lines = text_content if isinstance(text_content, list) else [text_content]
        
        # 获取配置参数
        font_size = title_config.get('fontSize', 16)
        line_height = title_config.get('lineHeight', 1.5)  # 默认行高为字体大小的1.2倍
        text_anchor = title_config.get('textAnchor', 'middle')
        
        # 计算每行文本的度量和总体尺寸
        line_metrics = []
        total_height = 0
        max_width = 0
        
        for line in text_lines:
            metrics = self._measureText(line, font_size, text_anchor)
            line_metrics.append(metrics)
            max_width = max(max_width, metrics['width'])
            if total_height > 0:
                total_height += (line_height - 1) * font_size  # 添加行间距
            total_height += metrics['height']
        
        # 创建标题组
        title_group = {
            'tag': 'g',
            'attributes': {'class': 'title-text-group'},
            'children': [],
            'bbox': {
                'minX': -max_width / 2 if text_anchor == 'middle' else 0,  # 默认居中对齐
                'minY': 0,
                'maxX': max_width / 2 if text_anchor == 'middle' else max_width,
                'maxY': total_height
            }
        }
        
        # 创建每行文本元素
        current_y = 0
        for i, (line, metrics) in enumerate(zip(text_lines, line_metrics)):
            # 计算当前行的y位置（考虑行高）
            if i > 0:
                current_y += font_size * line_height
            
            # 创建文本元素
            line_text = {
                'tag': 'text',
                'attributes': {
                    'class': 'chart-title-line',
                    'x': self._getTextXPosition(text_anchor, metrics['width']),
                    'y': str(current_y + metrics['ascent']),  # 基线对齐
                    'text-anchor': text_anchor,
                    'font-family': title_config.get('fontFamily', 'sans-serif'),
                    # 'font-size': font_size,
                    'font-size': 20,
                    'font-weight': title_config.get('fontWeight', 'bolder'),
                    'fill': title_config.get('color', '#000000')
                },
                'text': line
            }
            
            title_group['children'].append(line_text)
        
        return title_group

    def _getTextXPosition(self, text_anchor: str, width: float) -> str:
        """根据文本对齐方式计算x位置
        
        Args:
            text_anchor: 文本对齐方式
            width: 文本宽度
        
        Returns:
            str: x位置值
        """
        if text_anchor == 'start':
            return '0'
        elif text_anchor == 'end':
            return str(width)
        else:  # middle
            return '0'

    def _createSubtitleTextGroup(self, subtitle_config: Dict) -> Optional[dict]:
        """创建副标题组，支持多行文本
        
        Args:
            subtitle_config: 副标题配置信息
        """
        text_content = subtitle_config.get('text')
        if not text_content:
            return None
        
        # 将文本内容统一转换为列表形式
        text_lines = text_content if isinstance(text_content, list) else [text_content]
        
        # 获取配置参数
        font_size = subtitle_config.get('fontSize', 10)
        line_height = subtitle_config.get('lineHeight', 1.2)  # 默认行高为字��大小的1.2倍
        text_anchor = subtitle_config.get('textAnchor', 'middle')
        
        # 计算每行文本的度量和总体尺寸
        line_metrics = []
        total_height = 0
        max_width = 0
        
        for line in text_lines:
            metrics = self._measureText(line, font_size, text_anchor)
            line_metrics.append(metrics)
            max_width = max(max_width, metrics['width'])
            if total_height > 0:
                total_height += (line_height - 1) * font_size  # 添加行间距
            total_height += metrics['height']
        
        # 创建副标题组
        subtitle_group = {
            'tag': 'g',
            'attributes': {'class': 'subtitle-text-group'},
            'children': [],
            'bbox': {
                'minX': -max_width / 2 if text_anchor == 'middle' else 0,  # 默认居中对齐
                'minY': 0,
                'maxX': max_width / 2 if text_anchor == 'middle' else max_width,
                'maxY': total_height
            }
        }
        
        # 创建每行文本元素
        current_y = 0
        for i, (line, metrics) in enumerate(zip(text_lines, line_metrics)):
            # 计算当前行的y位置（考虑行高）
            if i > 0:
                current_y += font_size * line_height
            
            # 创建文本元素
            line_text = {
                'tag': 'text',
                'attributes': {
                    'class': 'chart-subtitle-line',
                    'x': self._getTextXPosition(text_anchor, metrics['width']),
                    'y': str(current_y + metrics['ascent']),  # 基线对齐
                    'text-anchor': text_anchor,
                    'font-family': subtitle_config.get('fontFamily', 'sans-serif'),
                    'font-size': font_size,
                    'font-weight': subtitle_config.get('fontWeight', 'normal'),
                    'fill': subtitle_config.get('color', '#808080')  # 副标题默认使用灰色
                },
                'text': line
            }
            
            subtitle_group['children'].append(line_text)
        
        return subtitle_group

    def _createTopicIcon(self, icon_config: Dict) -> dict:
        """创建主题图标
        
        Args:
            icon_config: 图标配置信息
        """
        if not icon_config.get('iconUrl'):
            return None
        
        # 获取图标的base64数据
        image_data = self._getImageAsBase64(icon_config['iconUrl'])
        if not image_data:
            return None
        
        return {
            'tag': 'image',
            'attributes': {
                'class': 'topic-icon',
                'href': f"data:{image_data}",
                'preserveAspectRatio': 'xMidYMid meet',
                'width': 75,
                'height': 75,
            },
            'bbox': {
                'minX': 0,
                'minY': 0,
                'maxX': 75,
                'maxY': 75
            }
        }

    def _buildLayout(self, layout_node: Dict, element_map: Dict, parent_node: Dict) -> None:
        """递归构建布局结构
        
        Args:
            layout_node: 布局树节点
            element_map: 元素映射
            parent_node: 父节点
        """
        tag = layout_node.get('tag')
        layout_rules = layout_node.get('layoutRules', {})
        
        # 创建当前层级的组
        current_group = {
            'tag': 'g',
            'attributes': {'class': f'{tag}-group'},
            'children': []
        }
        if layout_node.get('attributes',{}).get('class'):
            current_group['attributes']['class'] = layout_node.get('attributes').get('class')
        
        # 处理子节点
        children = layout_node.get('children', [])
        for child in children:
            child_tag = child.get('tag')
            child_class = child.get('attributes', {}).get('class')
            if child_class == 'chart-group' and child_tag == 'g':
                current_group['children'].append(child)
            # elif child_tag in element_map and element_map[child_tag]:
            elif child.get("children") and len(child["children"])>0:
                # 递归处理子布局
                self._buildLayout(child, element_map, current_group)
            else:
                current_group['children'].append(child)
        
        # 应用布局规则
        if layout_rules:
            self._applyLayoutRules(current_group, layout_rules)
        # 将当前组添加到父节点
        parent_node['children'].append(current_group)

    def _applyLayoutRules(self, group: Dict, rules: Dict) -> None:
        """应用布局规则
        
        Args:
            group: 要应用规则的组
            rules: 布局规则
        """
        if not group['children']:
            return
        
        layout_type = rules.get('layoutType', 'vertical')
        padding = rules.get('padding', 10)
        vertical_align = rules.get('verticalAlign', 'middle')
        horizontal_align = rules.get('horizontalAlign', 'middle')
        
        # 计算所有子元素的边界框
        for child in group['children']:
            if 'bbox' not in child:
                self._addBBoxToTree(child)
        

        # # 获取组的总边界
        # group_bbox = self._calculateGroupBBox(group['children'])
        # print(group.get('attributes').get('class'))
        # print(group_bbox)
        group_bbox = {'minX': 0, 'minY': 0, 'maxX': 0, 'maxY': 0, 'width': 0, 'height': 0}
        # 获取所有子元素的边界框
        for child in group['children']:
            print(child.get('attributes'), child.get('bbox'))
        
        max_width = max(child['bbox']['maxX']-child['bbox']['minX'] for child in group['children'])
        max_height = max(child['bbox']['maxY']-child['bbox']['minY'] for child in group['children'])
        
        # 根据布局类型排列元素
        current_pos = 0
        # 对group['children']进行排序，保证title在chart-group之前
        group['children'] = sorted(group['children'], key=lambda x: x.get('attributes', {}).get('class') == 'chart-group')
        # 对group['children']进行排序，保证topic_icon在最后面
        group['children'] = sorted(group['children'], key=lambda x: x.get('attributes', {}).get('class') != 'topic-icon')
        for i, child in enumerate(group['children']):
            if layout_type == 'vertical':
                # 垂直布局
                if i > 0:
                    current_pos += padding
                # 计算水平对齐位置
                if horizontal_align == 'middle':
                    new_maxX = (child['bbox']['maxX'] - child['bbox']['minX']) / 2
                    dx = new_maxX - child['bbox']['maxX']
                elif horizontal_align == 'right':
                    new_maxX = max_width
                    dx = new_maxX - child['bbox']['maxX']
                else:  # left
                    new_minX = 0
                    dx = new_minX - child['bbox']['minX']
                    
                # # 设置变换
                # transform = f'translate({dx},{current_pos})'
                # child['attributes']['transform'] = transform
                # 更新child的transform
                # 获取当前的transform
                current_transform = child.get('attributes', {}).get('transform')
                 
                if current_transform:
                    transform = f"{current_transform} translate({dx},{current_pos - child['bbox']['minY']})"
                    child['attributes']['transform'] = transform
                else:
                    child['attributes']['transform'] = f"translate({dx},{current_pos - child['bbox']['minY']})"
                # 更新位置
                current_pos += child['bbox']['maxY'] - child['bbox']['minY']
                
                # 更新group_bbox
                group_bbox['minY'] = 0
                group_bbox['maxY'] = current_pos
                group_bbox['height'] = current_pos
                if layout_type == 'vertical':
                    if horizontal_align == 'middle':
                        group_bbox['maxX'] = max(group_bbox['maxX'], (child['bbox']['maxX']-child['bbox']['minX'])/2)
                        group_bbox['minX'] = -group_bbox['maxX']
                        group_bbox['width'] = group_bbox['maxX'] - group_bbox['minX']
                    elif horizontal_align == 'right':
                        group_bbox['maxX'] = 0
                        group_bbox['minX'] = min(group_bbox['minX'], -(child['bbox']['maxX']-child['bbox']['minX']))
                    else:
                        group_bbox['maxX'] = max(group_bbox['maxX'], (child['bbox']['maxX']-child['bbox']['minX']))
                        group_bbox['minX'] = 0
                        group_bbox['width'] = group_bbox['maxX'] - group_bbox['minX']
                
            else:  # horizontal
                # 水平布局
                if i > 0:
                    current_pos += padding
                
                # 计算垂直对齐位置
                if vertical_align == 'middle':
                    new_maxY = (max_height - (child['bbox']['maxY'] - child['bbox']['minY'])) / 2
                    dy = new_maxY - child['bbox']['maxY']
                elif vertical_align == 'bottom':
                    new_maxY = max_height - (child['bbox']['maxY'] - child['bbox']['minY'])
                    dy = new_maxY - child['bbox']['maxY']
                else:  # top
                    new_minY = child['bbox']['minY']
                    dy = -new_minY
                    
                # 更新child的transform
                current_transform = child.get('attributes', {}).get('transform')
                if current_transform:
                    transform = f'{current_transform} translate({current_pos},{dy})'
                    child['attributes']['transform'] = transform
                else:
                    child['attributes']['transform'] = f'translate({current_pos},{dy})'
                
                # 更新位置
                current_pos += child['bbox']['maxX'] - child['bbox']['minX']
                
                # 更新group_bbox
                group_bbox['minX'] = 0
                group_bbox['maxX'] = current_pos
                group_bbox['width'] = current_pos
                if layout_type == 'horizontal':
                    if vertical_align == 'middle':
                        group_bbox['maxY'] = max(group_bbox['maxY'], (child['bbox']['maxY']-child['bbox']['minY'])/2)
                        group_bbox['minY'] = -group_bbox['maxY']
                        group_bbox['height'] = group_bbox['maxY'] - group_bbox['minY']
                    elif vertical_align == 'bottom':
                        group_bbox['maxY'] = 0
                        group_bbox['minY'] = min(group_bbox['minY'], -(child['bbox']['maxY']-child['bbox']['minY']))
                    else:
                        group_bbox['maxY'] = max(group_bbox['maxY'], (child['bbox']['maxY']-child['bbox']['minY']))
                        group_bbox['minY'] = 0
                        group_bbox['height'] = group_bbox['maxY'] - group_bbox['minY']
        

    def _calculateGroupBBox(self, children: List[Dict]) -> Dict:
        """计算组的总边界框
        
        Args:
            children: 子元素列表
        
        Returns:
            Dict: 边界框信息
        """
        if not children:
            return {'minX': 0, 'minY': 0, 'maxX': 0, 'maxY': 0, 'width': 0, 'height': 0}
        # for child in children:
        #     print(child['tag'], child.get('attributes'), child.get('bbox'))
        minX = min(child['bbox']['minX'] for child in children)
        minY = min(child['bbox']['minY'] for child in children)
        maxX = max(child['bbox']['maxX'] for child in children)
        maxY = max(child['bbox']['maxY'] for child in children)
        
        return {
            'minX': minX,
            'minY': minY,
            'maxX': maxX,
            'maxY': maxY,
            'width': maxX - minX,
            'height': maxY - minY
        }

    def _getBBoxImage(self, node: Dict) -> Dict[str, float]:
        """获取图片元素的边界框
        
        Args:
            node: 图片节点
            
        Returns:
            Dict[str, float]: 包含minX, minY, maxX, maxY的边界框字典
        """
        attrs = node['attributes']
        x = float(attrs.get('x', 0))
        y = float(attrs.get('y', 0))
        width = float(attrs.get('width', 0))
        height = float(attrs.get('height', 0))
        
        # 创建基本边界框
        bbox = {
            'minX': x,
            'minY': y,
            'maxX': x + width,
            'maxY': y + height
        }
        
        # 处理transform变换
        transform = attrs.get('transform')
        if transform:
            matrix = self._parseTransform(transform)
            if isinstance(matrix, list) and len(matrix) == 2:
                # 如果是两个矩阵，进行两次变换
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[0])
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix[1])
            else:
                bbox = self._applyTransform(bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY'], matrix)
        
        return bbox

    def _findEmptySpace(self, tree: dict, icon_size: float, padding: float, preferred_area: str) -> Optional[Dict]:
        """寻找图表中的空白区域
        
        Args:
            tree: SVG树结构
            icon_size: 图标大小
            padding: 间距
            preferred_area: 优先查找区域
        
        Returns:
            Optional[Dict]: 找到的空白区域位置,包含x和y坐标
        """
        # 获取图表的整体边界
        chart_bbox = tree.get('bbox', {})
        if not chart_bbox:
            return None
            
        # 收集所有元素的边界框
        element_boxes = []
        def collect_boxes(node):
            if 'bbox' in node:
                element_boxes.append(node['bbox'])
            for child in node.get('children', []):
                collect_boxes(child)
        
        collect_boxes(tree)
        
        # 定义候选位置
        candidates = []
        chart_width = chart_bbox['maxX'] - chart_bbox['minX']
        chart_height = chart_bbox['maxY'] - chart_bbox['minY']
        
        # 根据preferred_area确定搜索顺序
        if preferred_area == 'top-right':
            candidates = [
                (chart_bbox['maxX'] - icon_size - padding, chart_bbox['minY'] + padding),  # 右上
                (chart_bbox['minX'] + padding, chart_bbox['minY'] + padding),  # 左上
                (chart_bbox['maxX'] - icon_size - padding, chart_bbox['maxY'] - icon_size - padding),  # 右下
                (chart_bbox['minX'] + padding, chart_bbox['maxY'] - icon_size - padding)  # 左下
            ]
        elif preferred_area == 'top-left':
            candidates = [
                (chart_bbox['minX'] + padding, chart_bbox['minY'] + padding),  # 左上
                (chart_bbox['maxX'] - icon_size - padding, chart_bbox['minY'] + padding),  # 右上
                (chart_bbox['minX'] + padding, chart_bbox['maxY'] - icon_size - padding),  # 左下
                (chart_bbox['maxX'] - icon_size - padding, chart_bbox['maxY'] - icon_size - padding)  # 右下
            ]
        # ... 可以添加其他方向的搜索顺序
        
        # 检查每个候选位置是否有足够的空间
        for x, y in candidates:
            icon_bbox = {
                'minX': x - padding,
                'minY': y - padding,
                'maxX': x + icon_size + padding,
                'maxY': y + icon_size + padding
            }
            
            # 检查是否与任何现有元素重叠
            has_overlap = False
            for box in element_boxes:
                if self._checkOverlap(icon_bbox, box):
                    has_overlap = True
                    break
            
            if not has_overlap:
                return {'x': x, 'y': y}
        
        return None

    def _checkOverlap(self, box1: Dict, box2: Dict) -> bool:
        """检查两个边界框是否重叠
        
        Args:
            box1: 第一个边界框
            box2: 第二个边界框
        
        Returns:
            bool: 是否重叠
        """
        return not (box1['maxX'] < box2['minX'] or
                   box1['minX'] > box2['maxX'] or
                   box1['maxY'] < box2['minY'] or
                   box1['minY'] > box2['maxY'])

    def _processFloatIcon(self, tree: dict, float_config: Dict) -> None:
        """处理浮动图标
        
        Args:
            tree: SVG树结构
            float_config: 浮动图标配置
        """
        if not float_config or not float_config.get('iconUrl'):
            return
            
        # 获取图标的base64数据
        image_data = self._getImageAsBase64(float_config['iconUrl'])
        if not image_data:
            return
            
        # 寻找空白区域
        icon_size = float_config.get('size', 50)
        padding = float_config.get('padding', 10)
        preferred_area = float_config.get('preferredArea', 'top-right')
        
        position = self._findEmptySpace(tree, icon_size, padding, preferred_area)
        position = {'x': 100, 'y': 100}
        # if not position:
            # return
            
        # 创建图标元素
        float_icon = {
            'tag': 'image',
            'attributes': {
                'class': 'float-icon',
                'x': str(position['x']),
                'y': str(position['y']),
                'width': str(icon_size),
                'height': str(icon_size),
                'href': f"data:{image_data}",
                'preserveAspectRatio': 'xMidYMid meet'
            }
        }
        
        # 将图标添加到SVG中
        if 'children' not in tree:
            tree['children'] = []
        tree['children'].append(float_icon)