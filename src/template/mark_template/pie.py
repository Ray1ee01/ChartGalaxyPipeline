from typing import Optional, Dict, Any
from .base import MarkTemplate
from ..color_template import ColorDesign
import random

class PieTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign = None, config: Dict = None):
        super().__init__(color_template)
        self.type: str = "arc"
        self.radius: Optional[float] = config.get('radius', 100)
        self.innerRadius: Optional[float] = config.get('innerRadius', None)
        # 如果innerRadius为None，则从100到0之间随机取值
        if self.innerRadius is None:
            self.innerRadius = 50
            # self.innerRadius = random.randint(0, self.radius)
        self.height = config
        self.width = config
        self.orientation = None # 占位
        self.stroke_color_style.color = "#ffffff"
        self.stroke_style.stroke_width = 3
        # self.sort: Optional[bool] = True

    def dump(self) -> Dict[str, Any]:
        config = {
            "type": self.type,
            "radius": self.radius,
            "innerRadius": self.innerRadius
        }
        
        return config