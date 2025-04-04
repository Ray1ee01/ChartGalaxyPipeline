import json
from .elements import *

def extract_data_from_aria_label(aria_label: str, data_columns: list):
    res = {}    
    for data_column in data_columns:
        if data_column['name'] in aria_label:
            value = aria_label.split(data_column['name'])[1]
            if ';' in value:
                value = value.split(';')[0].split(':')[1].strip()
            else:
                value = value.split(':')[1].strip()
            res[data_column['name']] = value
    return res


def bind_data_to_element(element: LayoutElement, data_dict: dict):
    element.data_attributes = data_dict
    
def find_element_with_aria_label(element):
    if 'aria-label' in element.attributes:
        return element
    if hasattr(element, 'children'):
        for child in element.children:
            found = find_element_with_aria_label(child)
            if found:
                return found
    return None

def get_content_from_axis_label(axis_label: AxisLabel):
    if axis_label.children is not None:
        for child in axis_label.children:
            if child.tag == 'text':
                return child.content
    return None
