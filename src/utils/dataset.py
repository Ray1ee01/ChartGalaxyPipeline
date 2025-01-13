import os, json, tqdm

class VizNET:
    def __init__(self):
        self.path = '/data1/jiashu/data/viznet'
        json_files = []
        for root, dirs, files in os.walk(self.path):
            for file in files:
                if file.endswith('.json'):
                    json_files.append(os.path.join(root, file))
        self.json_files = json_files

    def get_file(self, index):
        json_file = self.json_files[index]
        json_objects = []
        with open(json_file, 'r', encoding='utf-8', errors='ignore') as file:
            for line in file:
                line = line.strip()
                if line:
                    try:
                        json_obj = json.loads(line)
                        json_objects.append(json_obj)
                    except json.JSONDecodeError as e:
                        print('json error:', e)
        return json_objects

    def get_file_length(self, index):
        json_file = self.json_files[index]
        with open(json_file, 'r', encoding='utf-8', errors='ignore') as file:
            return len(file.readlines())

    def get_object(self, file_index, object_index):
        json_objects = self.get_file(file_index)
        assert object_index < len(json_objects)
        return json_objects[object_index]


if __name__ == '__main__':
    dataset = VizNET()
    number = len(dataset.json_files)
    total_number = 0
    for i in tqdm.tqdm(range(number)):
        total_number += dataset.get_file_length(i)
    print('total number of objects:', total_number)