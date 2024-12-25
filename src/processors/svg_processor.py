from ..interfaces.base import SVGProcessor
from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from ..utils.node_bridge import NodeBridge
import os
import json

class SVGOptimizer(SVGProcessor):
    def __init__(self):
        self.node_bridge = NodeBridge()
        # 获取当前文件所在目录
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # 构建measure_text.js的路径
        self.measure_script_path = os.path.join(current_dir, 'svg_processor_modules', 'text_tool', 'measure_text.js')

    def process(self, svg: str, debug: bool = False) -> Union[dict, str]:
        """处理SVG并返回带有边界框信息的树结构或调试SVG
        
        Args:
            svg: 输入的SVG字符串
            debug: 是否返回带有边界框可视化的SVG
        
        Returns:
            Union[dict, str]: 如果debug为True，返回带有边界框的SVG字符串；
                             否则返回带有边界框信息的树结构
        """
        # 移除注释
        svg = re.sub(r'<!--.*?-->', '', svg, flags=re.DOTALL)
        # 压缩空白
        svg = re.sub(r'\s+', ' ', svg)
        
        if debug:
            return self.debug_draw_bbox(svg)
        
        tree = self.parseTree(svg)
        self._addBBoxToTree(tree)
        axes = self._findAxes(tree)

        # 获取X轴和Y轴
        x_axis = axes['x_axis']
        y_axis = axes['y_axis']
        print("x_axis", x_axis)
        print("y_axis", y_axis)

        return svg

    def _addBBoxToTree(self, node: dict, parent_transform: List[float] = None) -> None:
        """递归地为树中的每个节点添加边界框
        
        Args:
            node: 当前节点
            parent_transform: 父节点的变换矩阵
        """
        # print("node['tag']", node['tag'])
        # print("node['attributes']", node['attributes'])
        # print("node['class']", node.get('class'))
        # print("node['id']", node.get('id'))
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
        """应用变换到边界框的所有四个角点"""
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
        """解析带单位的长度值"""
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
        if raw_font_size:
            font_size = self._parseLength(raw_font_size)
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
            if tag != 'path':
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
        """查找SVG中的X轴和Y轴组
        
        Args:
            node: SVG节点树
            
        Returns:
            Dict[str, dict]: 包含 'x_axis' 和 'y_axis' 的字典
        """
        axes = {'x_axis': None, 'y_axis': None}
        
        def search_axes(node):
            if node.get('tag') == 'g' and \
               node.get('attributes', {}).get('class') == 'mark-group role-axis' and \
               node.get('attributes', {}).get('aria-roledescription') == 'axis':
                
                aria_label = node.get('attributes', {}).get('aria-label', '')
                if 'X-axis' in aria_label:
                    axes['x_axis'] = node
                elif 'Y-axis' in aria_label:
                    axes['y_axis'] = node
            
            # 递归搜索子节点
            for child in node.get('children', []):
                search_axes(child)
        
        search_axes(node)
        return axes
        