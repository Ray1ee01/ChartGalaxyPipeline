from src.processors.svg_processor_modules.elements import  LayoutElement, BoundingBox, Rect
from src.processors.svg_processor_modules.layout import RadialLayoutStrategy, CircularLayoutStrategy
import math

ref_element = Rect()
ref_element.bounding_box = BoundingBox(2, 2, 0, 2, 0, 2)
lay_element = Rect()
lay_element.bounding_box = BoundingBox(2, 2, 1e9, 1e9 + 2, 1e9, 1e9 + 2)
RadialLayoutStrategy(direction='outer', padding=5, circle_center=(-1, 1)).layout(ref_element, lay_element)

assert abs(lay_element.bounding_box.minx - 7) < 0.01 and abs(lay_element.bounding_box.miny - 0) < 0.01

ref_element = Rect()
ref_element.bounding_box = BoundingBox(2, 2, -2, 0, 0, 2)
lay_element = Rect()
lay_element.bounding_box = BoundingBox(2, 2, 1e9, 1e9 + 2, 1e9, 1e9 + 2)
RadialLayoutStrategy(direction='inner', padding=0, circle_center=(0, 0)).layout(ref_element, lay_element)

assert abs(lay_element.bounding_box.minx - 0) < 0.01 and abs(lay_element.bounding_box.miny - (-2)) < 0.01

ref_element = Rect()
ref_element.bounding_box = BoundingBox(2, 2,0, 2, 0, 2)
lay_element = Rect()
lay_element.bounding_box = BoundingBox(2, 2, 1e9, 1e9 + 2, 1e9, 1e9 + 2)
CircularLayoutStrategy(direction='anticlock', padding= (math.pi / 6) * 2, circle_center=(-1, 1)).layout(ref_element, lay_element)

assert abs(lay_element.bounding_box.minx - (-3)) < 0.01 and abs(lay_element.bounding_box.miny - (3 ** 0.5)) < 0.01

ref_element = Rect()
ref_element.bounding_box = BoundingBox(2, 2, 0, 2, 0, 2)
lay_element = Rect()
lay_element.bounding_box = BoundingBox(2, 2, 1e9, 1e9 + 2, 1e9, 1e9 + 2)
CircularLayoutStrategy(direction='clock', padding=0, circle_center=(-1e36, 1)).layout(ref_element, lay_element)

assert abs(lay_element.bounding_box.minx - 0) < 0.01 and abs(lay_element.bounding_box.miny - (-2)) < 0.01

