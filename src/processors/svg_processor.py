from ..interfaces.base import SVGProcessor
from typing import Optional
import re

class SVGOptimizer(SVGProcessor):
    def process(self, svg: str) -> str:
        # 示例：优化SVG
        # 移除注释
        svg = re.sub(r'<!--.*?-->', '', svg, flags=re.DOTALL)
        # 压缩空白
        svg = re.sub(r'\s+', ' ', svg)
        return svg
