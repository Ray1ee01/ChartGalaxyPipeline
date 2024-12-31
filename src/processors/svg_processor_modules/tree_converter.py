from typing import Dict, Any, Optional
from .elements import *

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
        cleaned_tree = SVGTreeConverter._clean_svg_tree(svg_tree)
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
        
        tag = element_tree.tag
        attrs_list = []
        for key, value in element_tree.attributes.items():
            attrs_list.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs_list)
        
        text_content = ""
        if isinstance(element_tree, Text):
            text_content = element_tree.content
        children_content = []
        children_str = ""
        if isinstance(element_tree, GroupElement):
            for child in element_tree.children:
                children_content.append(SVGTreeConverter.element_tree_to_svg(child))
            children_str = '\n'.join(children_content)
            
        if children_content or text_content:
            content = text_content + '\n' + children_str if text_content else children_str
            return f"<{tag} {attrs_str}>{content}</{tag}>"
        else:
            return f"<{tag} {attrs_str}/>"
        
    
    @staticmethod
    def _clean_svg_tree(node: Dict[str, Any]) -> Dict[str, Any]:
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
            node['children'] = [SVGTreeConverter._clean_svg_tree(child) for child in children]
            
        tag = node.get('tag', '').lower()
        attrs = node.get('attributes', {})
        
        # 如果是g标签且只有一个子节点
        if (tag == 'g' and len(node.get('children', [])) == 1 and 
            node['children'][0].get('tag', '').lower() == 'g'):
            child = node['children'][0]
            
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
            return child
            
        return node
    
    @staticmethod
    def _convert_node(node: Dict[str, Any]) -> Optional[LayoutElement]:
        """转换单个节点
        
        Args:
            node: SVG节点数据
            
        Returns:
            转换后的Element节点
        """
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