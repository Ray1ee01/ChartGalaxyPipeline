from .elements import *
import copy
from typing import Any, Dict, List, Optional

class SVGTreeConverter:
    """将SVG解析树转换为Elements树结构"""
    
    @staticmethod
    def convert(svg_tree: Dict[str, Any]) -> Optional[LayoutElement]:
        """将SVG树转换为Elements树
        
        Args:
            svg_tree: 解析后的SVG树结构
            
        Returns:
            转换后的Elements树根节点
        """
        if not svg_tree:
            return None
            
        # 首先清理SVG树
        # cleaned_tree = GroupElement()
        cleaned_tree = {
            "tag": "g",
            "attributes": {},
            "children": []
        }
        cleaned_tree['children'] = SVGTreeConverter._clean_svg_tree(svg_tree)
        return SVGTreeConverter._convert_node(cleaned_tree)
    
    @staticmethod
    def flatten_tree(tree: LayoutElement) -> List[LayoutElement]:
        """将Elements树转换为扁平结构"""
        """去除所有GroupELement,只保留AtomElement"""
        """去除过程中将transform属性累加"""
        if not tree:
            return []
            
        result = []
        
        # 如果是原子元素,直接添加到结果中
        if isinstance(tree, AtomElement):
            result.append(tree)
            return result
            
        # 如果是组元素,递归处理子元素
        if isinstance(tree, GroupElement):
            # 获取当前组的transform
            current_transform = tree.attributes.get('transform', '')
            current_attributes = tree.attributes.copy()
            
            # 处理每个子元素
            for child in tree.children:
                # 递归获取子树的扁平结构
                child_elements = SVGTreeConverter.flatten_tree(child)
                # 将当前transform应用到每个子元素
                for element in child_elements:
                    # 用current_attributes 更新element的attributes
                    for key, value in current_attributes.items():
                        if key not in element.attributes and key != 'transform':
                            element.attributes[key] = value
                    if current_transform:
                        child_transform = element.attributes.get('transform', '')
                        if child_transform:
                            # 如果子元素已有transform,则串联
                            element.attributes['transform'] = f"{current_transform} {child_transform}"
                        else:
                            element.attributes['transform'] = current_transform
                            
                result.extend(child_elements)
                
        return result
    
    @staticmethod
    def partial_flatten_tree(tree: LayoutElement, group_to_flatten: Dict[str, LayoutElement]) -> LayoutElement:
        """与flatten_tree类似，但是只把group_to_flatten中的group元素展开，其他group元素保持不变"""
        
        if not tree:
            return None
        
        if tree.tag == 'g':
            child_idxs = []
            if len(tree.children) > 0:
                for idx, child in enumerate(tree.children):
                    if child in group_to_flatten.values():
                        child_idxs.append(idx)
            if len(child_idxs) > 0:
                # 将group_to_flatten中的group元素展开
                reverse_child_idxs = child_idxs.copy()
                reverse_child_idxs.reverse()
                for idx in reverse_child_idxs:
                    child = tree.children[idx]
                    for child_child in child.children:
                        tree.children.insert(idx, child_child)
                    # 删除原来的child
                    tree.children.pop(idx+1)
            for child in tree.children:
                child = SVGTreeConverter.partial_flatten_tree(child, group_to_flatten)
        else:
            return tree
        return tree
    @staticmethod
    def elements_to_svg(elements: List[LayoutElement], svg: Dict[str, Any]) -> str:
        """将Elements树转换为SVG字符串"""
        svg_attrs = svg['attributes']
        attrs = []
        for key, value in svg_attrs.items():
            attrs.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs)
        
        
        result = ""
        svg_left = f"<{svg['tag']} {attrs_str} xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
        result += svg_left
        svg_right = f"</{svg['tag']}>"
        
        
        for element in elements:
            tag = element.tag
            element_attrs = element.attributes
            element_attrs_list = []
            for key, value in element_attrs.items():
                element_attrs_list.append(f'{key}="{value}"')
            element_attrs_str = ' '.join(element_attrs_list)
            if tag == 'text':
                svg_content = f"<{tag} {element_attrs_str}>{element.content}</{tag}>"
            else:
                svg_content = f"<{tag} {element_attrs_str}/>"
            result += svg_content+'\n'
        
        result += svg_right
        return result
    
    @staticmethod
    def element_tree_to_svg(element_tree: LayoutElement) -> str:
        """将Elements树转换为SVG字符串"""
        
        # print("element_tree: ", element_tree)
        tag = element_tree.tag
        attrs_list = []
        for key, value in element_tree.attributes.items():
            if element_tree.tag == 'image' and key == 'clip-path':
                continue
            attrs_list.append(f'{key}="{value}"')
        # 如果是GroupElement，则添加transform属性
        # if isinstance(element_tree, GroupElement):
        #     attrs_list.append(f'transform="translate({element_tree.attributes.get("x", 0)},{element_tree.attributes.get("y", 0)})"')
            
        attrs_str = ' '.join(attrs_list)
        
        text_content = ""
        if isinstance(element_tree, Text):
            text_content = element_tree.content
        children_content = []
        children_str = ""
        if isinstance(element_tree, (GroupElement, Infographics, Title, Description, Chart, Background, Axis, AxisLabel, AxisTick, AxisDomain, AxisTitle, Mark, BarMark, PathMark, ArcMark, AreaMark, PointMark)):
            # print("element_tree.children: ", element_tree.children)
            for child in element_tree.children:
                children_content.append(SVGTreeConverter.element_tree_to_svg(child))
            children_str = '\n'.join(children_content)
            
        if children_content or text_content:
            content = text_content + '\n' + children_str if text_content else children_str
            return f"<{tag} {attrs_str}>{content}</{tag}>"
        else:
            return f"<{tag} {attrs_str}/>"
    
    @staticmethod
    def element_tree_to_svg_file(element_tree: LayoutElement):
        boundingbox = element_tree.get_bounding_box()
        min_x = boundingbox.minx
        min_y = boundingbox.miny
        # 通过添加transform属性，把boundingbox的minx, miny设置为0
        element_tree.attributes['transform'] = f"translate({-min_x:.2f},{-min_y:.2f})" + element_tree.attributes.get('transform', '') 
        boundingbox = element_tree.get_bounding_box()
        min_x = boundingbox.minx
        min_y = boundingbox.miny
        width = boundingbox.width
        height = boundingbox.height
        viewBox = f"{min_x:.2f} {min_y:.2f} {width:.2f} {height:.2f}"
        svg_attrs = {
            "width": f"{boundingbox.maxx:.2f}",
            "height": f"{boundingbox.maxy:.2f}",
            "viewBox": viewBox,
            "xmlns": "http://www.w3.org/2000/svg",
            "xmlns:xlink": "http://www.w3.org/1999/xlink"
        }
        attrs_list = []
        for key, value in svg_attrs.items():
            attrs_list.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs_list)
        svg_str = SVGTreeConverter.element_tree_to_svg(element_tree)
        
        svg_left = f"<svg {attrs_str}>"
        svg_right = f"</svg>"
        svg_str = svg_left + svg_str + svg_right
        return svg_str
    
    @staticmethod
    def _clean_svg_tree(node: Dict[str, Any]) -> List[Dict[str, Any]]:
        """清理SVG树中的冗余节点
        
        Args:
            node: SVG节点数据
            
        Returns:
            清理后的节点数据
        """
        if not node:
            return node
            
        # 递归清理子节点
        children = node.get('children', [])
        if children:
            # 过滤掉background和foreground的path
            filtered_children = []
            for child in children:
                if (child.get('tag', '').lower() == 'path' and 
                    child.get('attributes', {}).get('class', '') in ['background', 'foreground']):
                    continue
                filtered_children.extend(SVGTreeConverter._clean_svg_tree(child))
            node['children'] = filtered_children
            
        tag = node.get('tag', '').lower()
        attrs = node.get('attributes', {})
        
        # 如果是g标签且只有transform属性或者没有属性
        if (tag == 'g') and \
            (len(node.get('attributes', {})) == 1 and 'transform' in node.get('attributes', {})) or (len(node.get('attributes', {})) == 0) or "stroke-miterlimit" in node.get('attributes', {}):
            res_list = []
            for child in node['children']:
                # 合并属性
                child_attrs = child.get('attributes', {})
                merged_attrs = attrs.copy()
                merged_attrs.update(child_attrs)
                
                # 合并transform
                parent_transform = attrs.get('transform', '')
                child_transform = child_attrs.get('transform', '')
                
                if parent_transform and child_transform:
                    # 解析transform类型和值
                    parent_type = parent_transform.split('(')[0].strip()
                    child_type = child_transform.split('(')[0].strip()
                    
                    if parent_type == child_type:
                        # 如果是相同类型的transform,提取数值并累加
                        parent_values = parent_transform.split('(')[1].split(')')[0].split(',')
                        child_values = child_transform.split('(')[1].split(')')[0].split(',')
                        merged_values = [float(p) + float(c) for p,c in zip(parent_values, child_values)]
                        merged_attrs['transform'] = f"{parent_type}({','.join(str(v) for v in merged_values)})"
                    else:
                        # 不同类型则串联
                        merged_attrs['transform'] = f"{parent_transform} {child_transform}"
                elif parent_transform:
                    merged_attrs['transform'] = parent_transform
                elif child_transform:
                    merged_attrs['transform'] = child_transform
                    
                # 更新子节点属性并返回
                child['attributes'] = merged_attrs
                res_list.append(child)
            return res_list
        return [node]
    
    @staticmethod
    def _convert_node(node: Dict[str, Any]) -> Optional[LayoutElement]:
        """转换单个节点
        
        Args:
            node: SVG节点数据
            
        Returns:
            转换后的Element节点
        """
        # print("node: ", node)
        tag = node.get('tag', '').lower()
        attrs = node.get('attributes', {})
        
        # 创建对应的元素
        element = SVGTreeConverter._create_element(tag, attrs, node)
        if not element:
            return None
        
        # 如果是组元素，递归转换子节点
        if isinstance(element, GroupElement):
            for child in node.get('children', []):
                child_element = SVGTreeConverter._convert_node(child)
                if child_element:
                    element.children.append(child_element)
        
        return element
    
    @staticmethod
    def _create_element(tag: str, attrs: Dict[str, Any], node: Dict[str, Any]) -> Optional[LayoutElement]:
        """根据标签创建对应的元素
        
        Args:
            tag: SVG标签
            attrs: 节点属性
            node: 完整节点数据
            
        Returns:
            创建的Element对象
        """
        element = None
        
        if tag == 'g' or tag == 'svg':
            element = GroupElement()
            
        elif tag == 'image':
            base64 = attrs.get('href', '')
            element = Image(base64)
            
        elif tag == 'text':
            content = node.get('text', '')
            element = Text(content)
            
        elif tag == 'rect':
            element = Rect()
            
        elif tag == 'line':
            element = Line(
                float(attrs.get('x1', 0)),
                float(attrs.get('x2', 0)),
                float(attrs.get('y1', 0)),
                float(attrs.get('y2', 0))
            )
            
        elif tag == 'path':
            element = Path(attrs.get('d', ''))
            
        elif tag == 'circle':
            element = Circle(
                float(attrs.get('cx', 0)),
                float(attrs.get('cy', 0)),
                float(attrs.get('r', 0))
            )
        
        if element:
            element.attributes = attrs.copy()  # 保存节点的属性
        return element 
    
    @staticmethod
    def move_groups_to_top(tree: LayoutElement, groups_to_move: Dict[str, LayoutElement]) -> LayoutElement:
        """将指定的group元素的子树完全展开并移动到树的顶层，并累加transform属性
        
        Args:
            tree: 原始元素树
            groups_to_move: 需要移动到顶层的group元素字典
            
        Returns:
            处理后的元素树和顶层分组的字典
        """
        if not tree:
            return None
        
        # 创建新的根节点
        root = GroupElement()
        root.attributes = tree.attributes.copy()
        
        # 存储需要移动到顶层的元素
        top_level_elements = []
        
        top_level_groups = {}
        for key, value in groups_to_move.items():
            top_level_groups[key] = []

        def flatten_group(node, parent_transform='', parent_attributes=None):
            """递归展开group节点的子树"""
            if parent_attributes is None:
                parent_attributes = {}
                
            flattened = []
            current_transform = node.attributes.get('transform', '')
            current_attributes = node.attributes.copy()
            
            # 合并transform
            final_transform = ''
            if parent_transform and current_transform:
                final_transform = f"{parent_transform} {current_transform}"
            elif parent_transform:
                final_transform = parent_transform
            elif current_transform:
                final_transform = current_transform
                
            # 合并属性
            merged_attributes = parent_attributes.copy()
            merged_attributes.update(current_attributes)
            
            for child in node.children:
                # print("child: ", child.dump())
                if isinstance(child, GroupElement):
                    # 递归展开子group
                    flattened.extend(flatten_group(child, final_transform, merged_attributes))
                else:
                    # 处理叶子节点
                    if SVGTreeConverter.if_ignore_element(child):
                        continue
                    child_copy = copy.deepcopy(child)
                    # 更新属性
                    # print("merged_attributes: ", merged_attributes)
                    # print("child_copy: ", child_copy.tag, child_copy.attributes)
                    for key, value in merged_attributes.items():
                        # print("key: ", key, "value: ", value)
                        if key not in child_copy.attributes and key != 'transform':
                            # print("notin")
                            child_copy.attributes[key] = value
                    # print("child_copy: ", child_copy.tag, child_copy.attributes)
                    # 更新transform
                    if final_transform:
                        child_transform = child_copy.attributes.get('transform', '')
                        if child_transform:
                            child_copy.attributes['transform'] = f"{final_transform} {child_transform}"
                        else:
                            child_copy.attributes['transform'] = final_transform
                    flattened.append(child_copy)
            
            return flattened
        
        def process_node(node, parent_transform='', parent_attributes=None):
            if parent_attributes is None:
                parent_attributes = {}
                
            if node in groups_to_move.values():
                # print("node: ", node)
                # 找到对应的key
                # for key, value in groups_to_move.items():
                #     if value == node:
                #         # print("key: ", key)
                #         break
                
                group_key = list(groups_to_move.keys())[list(groups_to_move.values()).index(node)]
                # 完全展开该group的子树
                flattened_children = flatten_group(node, parent_transform, parent_attributes)
                top_level_elements.extend(flattened_children)
                top_level_groups[group_key].extend(flattened_children)
                return None
                
            elif isinstance(node, GroupElement):
                # 处理普通group节点
                new_group = GroupElement()
                new_group.attributes = node.attributes.copy()
                new_group.children = []
                
                current_transform = node.attributes.get('transform', '')
                current_attributes = node.attributes.copy()
                
                # 合并transform
                final_transform = ''
                if parent_transform and current_transform:
                    final_transform = f"{parent_transform} {current_transform}"
                elif parent_transform:
                    final_transform = parent_transform
                elif current_transform:
                    final_transform = current_transform
                
                # 合并属性
                final_attributes = current_attributes.copy()
                for key, value in parent_attributes.items():
                    if key not in current_attributes and key != 'transform':
                        final_attributes[key] = value
                
                # 处理子节点
                for child in node.children:
                    processed_child = process_node(child, final_transform, final_attributes)
                    if processed_child:
                        new_group.children.append(processed_child)
                        
                return new_group if new_group.children else None
            else:
                # 处理非group节点
                return copy.deepcopy(node)
        
        # 处理整个树
        processed_tree = process_node(tree)
        if processed_tree:
            root.children.append(processed_tree)
        
        # 将收集的元素添加到顶层
        root.children.extend(top_level_elements)
        
        return root, top_level_groups

    
            
    @staticmethod
    def remove_elements_by_class(tree, class_name):
        # 如果当前节点有class属性且包含目标class,返回None表示移除该节点
        if 'class' in tree.attributes and class_name in tree.attributes['class']:
            return None
        
        # 如果有子节点,递归处理每个子节点
        if hasattr(tree, 'children'):
            # 过滤掉返回None的子节点
            tree.children = [
                child for child in tree.children 
                if (result := SVGTreeConverter.remove_elements_by_class(child, class_name)) is not None
            ]
            return tree
        return tree
    
    @staticmethod
    def if_ignore_element(element: LayoutElement) -> bool:
        if 'background' in element.attributes.get('class', '') or 'foreground' in element.attributes.get('class', ''):
            return True
        return False
    
    @staticmethod
    def defs_to_svg(defs: Dict[str, Any]) -> str:
        def parse_defs(defs: Dict[str, Any]) -> str:
            defs_str = f'<{defs["tag"]} '
            for key, value in defs['attributes'].items():
                defs_str += f'{key}="{value}"'
            defs_str += '>'
            for child in defs['children']:
                defs_str += parse_defs(child)
            defs_str += f'</{defs["tag"]}>'
            return defs_str
        
        defs_str = parse_defs(defs)
        print("defs_str: ", defs_str)
        return defs_str
    
    @staticmethod
    def _clean_element_tree(element: LayoutElement) -> List[LayoutElement]:
        """清理SVG树中的冗余节点
        
        Args:
            node: SVG节点数据
            
        Returns:
            清理后的节点数据
        """
        # if not element:
        #     return element
        # 如果element没有children属性，则返回element
        if not hasattr(element, 'children'):
            return [element]
        # print("element: ", element.tag, element.attributes.get('class', ''))
        # 递归清理子节点
        children = element.children
        if children:
            # 过滤掉background和foreground的path
            filtered_children = []
            for child in children:
                if (child.tag == 'path' and 
                    child.attributes.get('class', '') in ['background', 'foreground']):
                    continue
                filtered_children.extend(SVGTreeConverter._clean_element_tree(child))
            element.children = filtered_children
            
        tag = element.tag
        attrs = element.attributes
        
        available_classes = ['chart', 'axis X', 'axis Y','use-image', 'title', 'description', 'background', 'axis-label', 'axis-tick', 'axis-domain', 'axis-title', 
                             'mark', 'bar', 'line', 'area', 'point', 'arc', 'path', 'circle', 'rect', 'text', 
                             'axis_label-group', 'axis_tick-group', 'axis_domain-group', 'axis_title-group','mark_group']
        
        # 如果是g标签且class不在available_classes中，把当前节点展平
        if tag == 'g' and (('class' in attrs and attrs['class'] not in available_classes) or ('class' not in attrs)):
            res_list = []
            print("not in list ", "attrs: ", attrs.get('class', ''))
            # print("node: ", node)
            for child in element.children:
                # 合并属性
                child_attrs = child.attributes
                merged_attrs = attrs.copy()
                merged_attrs.update(child_attrs)
                
                # 合并transform
                parent_transform = attrs.get('transform', '')
                child_transform = child_attrs.get('transform', '')
                
                if parent_transform and child_transform:
                    # 解析transform类型和值
                    parent_type = parent_transform.split('(')[0].strip()
                    child_type = child_transform.split('(')[0].strip()
                    
                    if parent_type == child_type:
                        # 如果是相同类型的transform,提取数值并累加
                        parent_values = parent_transform.split('(')[1].split(')')[0].split(',')
                        child_values = child_transform.split('(')[1].split(')')[0].split(',')
                        merged_values = [float(p) + float(c) for p,c in zip(parent_values, child_values)]
                        merged_attrs['transform'] = f"{parent_type}({','.join(str(v) for v in merged_values)})"
                    else:
                        # 不同类型则串联
                        merged_attrs['transform'] = f"{parent_transform} {child_transform}"
                elif parent_transform:
                    merged_attrs['transform'] = parent_transform
                elif child_transform:
                    merged_attrs['transform'] = child_transform
                    
                # 更新子节点属性并返回
                child.attributes = merged_attrs
                res_list.append(child)
            # for child in res_list:
            #     print("child: ", child.tag, child.attributes.get('class', ''))
            return res_list
        return [element]