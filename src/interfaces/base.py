from abc import ABC, abstractmethod
from typing import Any, Dict, List
from ..template.template import ChartTemplate

class DataProcessor(ABC):
    @abstractmethod
    def process(self, raw_data: Any) -> List[Dict]:
        pass

class ChartGenerator(ABC):
    @abstractmethod
    def generate(self, data: List[Dict], template: ChartTemplate=None) -> str:
        pass

class SVGProcessor(ABC):
    @abstractmethod
    def process(self, svg: str) -> str:
        pass