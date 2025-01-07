from src.utils.dataset import VizNET
from src.processors.data_processor import VizNetDataProcessor

import os

output_dir = os.path.join(os.path.dirname(__file__),'src', 'output')

def main():
    dataset = VizNET()
    input_data = dataset.get_object(0, 0)
    data_processor = VizNetDataProcessor()
    processed_data = data_processor.process(input_data)
    print(processed_data)

if __name__ == "__main__":
    main()