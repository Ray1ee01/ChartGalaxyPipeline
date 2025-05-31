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
python -m modules.title_generator.title_generator --input input_data.json --output output_data.json --index_path faiss_infographics.index --data_path infographics_data.npy --topk 3 --api_key your_api_key --base_url your_base_url
```

### 程序调用

```python
from modules.title_generator.title_generator import process

success = process(
    input='input_data.json', 
    output='output_data',
    index_path='faiss_infographics.index',
    data_path='infographics_data.npy',
    topk=3,
    api_key='your_api_key',
    base_url='your_base_url'
)
if success:
    print("数据洞察生成完成")
else:
    print("数据洞察生成失败")
```

## 构建标题生成所需的向量索引
标题生成模块使用一个基于 FAISS 的向量索引来支持检索增强生成（RAG）。该索引需要通过历史图表数据构建，一般仅需在首次使用或数据更新时运行一次。

### 数据格式

构建索引的训练数据应为JSON格式，结构如下：
```json
{
  "chart_id_1": {
    "metadata": {
      "title": "图表标题",
      "description": "图表描述",
      "main_insight": "图标洞察"
    },
    "chart_type": ["图表类型"],
    "datafacts": [{"annotation": "数据洞察"}],
    "data": {
      "columns": [{"name": "列名", "type": "列类型"}],
      "data": [{"列名": "值"}]
    }
  },
  "chart_id_2": {
    // 其他图表数据...
  }
}
```

### 使用方式

#### 命令行调用
```bash
python -m modules.title_generator.build_title_index --data training_data.json --index_path faiss_infographics.index --data_path infographics_data.npy
```

#### 程序调用
```python
from modules.title_generator.build_title_index import process

success = process(
    data='training_data.json',
    index_path='faiss_infographics.index',
    data_path='infographics_data.npy'
)
if success:
    print("索引构建完成")
else:
    print("索引构建失败")
```