from typing import Optional, Dict, Any
from .base import MarkTemplate
from ..color_template import ColorDesign

class PieTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign = None, config: Dict = None):
        super().__init__(color_template)
        self.type: str = "arc"
        self.radius: Optional[float] = config.get('radius', None)
        self.innerRadius: Optional[float] = config.get('innerRadius', None)
        self.height = config
        self.width = config
        self.orientation = None # 占位
        # self.sort: Optional[bool] = True

    def dump(self) -> Dict[str, Any]:
        config = {
            "type": self.type,
            "radius": self.radius,
            "innerRadius": self.innerRadius
        }
        
        return config