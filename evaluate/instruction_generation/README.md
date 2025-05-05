# 图表问答生成工具

这个工具可以从图表数据生成问答对，并以标准JSONL格式输出，支持批量处理多个数据目录。

## 新增功能

- **标准JSONL格式**: 符合通用数据集格式，包含元数据和分类信息
- **模板分类**: 根据模板ID自动分类为chartvqa或style类别
- **类别比例控制**: 可以设置style类型问题的比例，默认为50%
- **批量处理**: 可批量处理多个图表数据目录，并将结果追加到同一个输出文件
- **精确指导后缀**: 为不同类型的问题添加适当的指导后缀，确保模型回答格式正确
- **多选题生成**: 为适当的问题自动生成选项列表

## JSONL输出格式

每个问答对以JSON Lines格式输出，每行包含一个完整的JSON对象：

```json
{"id": "chart_123_abc123_001", "image": "images/chart_123_abc123.png", "conversation": [{"role": "human", "content": "What is the highest value in this chart?"}, {"role": "assistant", "content": "45.7"}], "metadata": {"source": "chart_data", "category": "chartvqa", "difficulty": "medium"}}
```

### 字段说明

- `id`: 唯一标识符，由前缀ID、随机字符串和序号组成
- `image`: 图像文件相对路径
- `conversation`: 包含问题和答案的对话数组
  - `role`: "human"（问题）或"assistant"（答案）
  - `content`: 问题或答案的内容
- `metadata`: 元数据信息
  - `source`: 数据来源，固定为"chart_data"
  - `category`: 问题类别，可能值为"chartvqa"或"style"
  - `difficulty`: 问题难度，可能值为"easy"、"medium"或"hard"

## 模板分类规则

- 模板ID为1-40: 分类为"chartvqa"，难度为"medium"
- 模板ID大于40: 分类为"style"，难度为"easy"

## 使用方法

### 处理单个数据目录

```python
from main import process

results = process(
    data_path="./data_path",  # 数据路径
    output_path="./output.jsonl",  # 输出文件路径
    template_path="./template.json",  # 模板路径
    write2disk=True,  # 是否写入磁盘
    use_model=False,  # 是否使用模型生成问答对
    use_template=True,  # 是否使用模板生成问答对
    image_output_dir="./images",  # 图像输出目录
    custom_instruction_suffix="Your answer should be direct and concise...",  # 自定义指导后缀
    include_multiple_choice=True,  # 是否为适当的问题添加多选项
    prefix_id="chart_001",  # 可选的ID前缀
    append_mode=False  # 是否追加到现有文件
)
```

### 批量处理多个数据目录

```python
from main import process_folder

total_pairs = process_folder(
    folder_path="./data_pool",  # 包含多个数据目录的父文件夹
    output_path="./train.jsonl",  # 输出文件
    template_path="./template.json",  # 模板路径
    image_output_dir="./images",  # 图像输出目录
    custom_instruction_suffix="Your answer should be direct and concise...",  # 自定义指导后缀
    include_multiple_choice=True,  # 是否为适当的问题添加多选项
    style_percentage=50  # style类型问题占比，默认为50%
)
```

## 示例

参见`example_usage.py`文件了解详细使用示例。 