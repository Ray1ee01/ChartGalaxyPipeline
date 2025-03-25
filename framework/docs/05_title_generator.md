# 标题生成模块 (title_generator)

标题生成模块（`title_generator`）是 ChartPipeline 框架的第三个处理环节，负责基于数据内容和洞察生成有吸引力的标题和副标题。

## 功能简介

本模块通过分析数据洞察和图表类型，生成能够准确概括数据主题并突出关键发现的标题。生成的标题简洁明了，引人入胜，使读者能够迅速理解可视化内容的核心信息。

## 输入与输出

### 输入

模块接收包含以下字段的数据对象：

- `metadata`: 原始元数据（包含标题、描述等）
- `chart_type`: 图表类型推荐
- `datafacts`: 数据洞察

### 输出

模块向输入数据添加 `titles` 字段，结构如下：

```json
{
  "titles": {
    "main_title": "美国国家紧急状态持续增长",
    "sub_title": "1976年以来宣布的紧急状态中大多数仍然有效"
  }
}
```

输出字段说明：

| 字段 | 类型 | 描述 |
|------|------|------|
| `main_title` | 字符串 | 图表主标题，简洁地概括核心信息 |
| `sub_title` | 字符串 | 图表副标题，提供补充信息和上下文 |

## 实现方法：RAG-based 标题生成

本模块采用基于检索增强生成（Retrieval-Augmented Generation, RAG）的方法实现标题生成，主要包括以下技术点：

1. **向量化和相似度检索**: 使用SentenceBERT将输入数据转换为语义向量，并通过FAISS向量数据库高效检索相似样例
2. **数据预处理**: 将输入的图表数据、元数据和数据洞察组织成结构化文本
3. **相似案例检索**: 基于输入数据的语义特征，检索训练集中最相似的图表及其标题
4. **大模型增强生成**: 结合检索到的案例和当前数据特征，通过大语言模型生成适合的标题和副标题

## 使用示例

### 命令行调用

```bash
python -m modules.title_generator.title_generator --input input_data.json --output output_data.json
```

### 程序调用

```python
from modules.title_generator.title_generator import process

success = process(input='input_data.json', output='output_data.json')
if success:
    print("数据洞察生成完成")
else:
    print("数据洞察生成失败")
```