class DataFactGenerator:
    def __init__(self, chart_data, topic_data):
        self.chart_data = chart_data
        self.topic_data = topic_data

    def generate_data_fact(self):
        data_fact = {}
        data_fact['trend'] = self.generate_trend()
        data_fact['top_bottom'] = self.generate_top_bottom()
        return data_fact
    
    def generate_trend(self):
        data_fact = {}
        if 'group' not in self.chart_data['data'][0] and \
            self.chart_data['meta_data']['x_type'] == 'temporal' and self.chart_data['meta_data']['chart_type'] != 'scatter':
            # check increasing or decreasing
            y_data = [v['y_data'] for v in self.chart_data['data']]
            if all([y_data[i] <= y_data[i+1] for i in range(len(y_data)-1)]):
                data_fact['trend'] = 'increasing'
            elif all([y_data[i] >= y_data[i+1] for i in range(len(y_data)-1)]):
                data_fact['trend'] = 'decreasing'
        return data_fact
    
    def generate_top_bottom(self):
        data_fact = {}
        # top and bottom
        if 'group' not in self.chart_data['data'][0] and \
            self.chart_data['meta_data']['x_type'] == 'categorical' and self.chart_data['meta_data']['chart_type'] != 'scatter':
            y_data = [v['y_data'] for v in self.chart_data['data']]
            # check top and bottom (must be single line)
            max_y = max(y_data)
            all_index_max = [i for i, v in enumerate(y_data) if v == max_y]
            if len(all_index_max) == 1:
                data_fact['top'] = all_index_max[0]
            min_y = min(y_data)
            all_index_min = [i for i, v in enumerate(y_data) if v == min_y]
            if len(all_index_min) == 1:
                data_fact['bottom'] = all_index_min[0]
        return data_fact