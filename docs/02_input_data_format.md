# 输入数据格式规范

ChartPipeline 框架接受结构化的 JSON 数据作为输入。正确的数据格式对于框架的正常运行至关重要。本文档详细介绍了 ChartPipeline 的标准输入格式。

## 基本结构

输入 JSON 由两个主要部分组成：`metadata` 和 `data`。

```json
{
  "metadata": { ... },
  "data": { ... }
}
```

## 元数据 (metadata)

`metadata` 部分包含关于数据集的描述性信息：

```json
"metadata": {
  "title": "The United States of Emergency",
  "description": "Number of national emergencies declared in the United States since 1976, by current status",
  "main_insight": "The number of national emergencies declared in the US has generally increased over time, with a significant number of those declared since 2000 still active."
}
```

| 字段 | 类型 | 描述 | 必填 |
|------|------|------|------|
| `title` | 字符串 | 图表的主标题 | 是 |
| `description` | 字符串 | 对数据的简要描述 | 是 |
| `main_insight` | 字符串 | 数据揭示的主要洞察 | 是 |

## 数据 (data)

`data` 部分包含实际的数据和列元数据：

```json
"data": {
  "columns": [ ... ],
  "data": [ ... ]
}
```

### 列定义 (columns)

`columns` 数组定义了数据集中每一列的属性：

```json
"columns": [
  {
    "name": "Time Period",
    "importance": "primary",
    "description": "Time periods of national emergencies declared",
    "unit": "none",
    "data_type": "temporal",
    "role": "x"
  },
  // 更多列定义...
]
```

每个列定义应包含以下字段：

| 字段 | 类型 | 描述 | 必填 | 可选值 |
|------|------|------|------|--------|
| `name` | 字符串 | 列名称，在数据中用作键 | 是 | |
| `importance` | 字符串 | 列的重要性级别 | 是 | `primary`, `secondary` |
| `description` | 字符串 | 对列内容的描述 | 是 | |
| `unit` | 字符串 | 数据的度量单位 | 是 | `none`, `percent`, `currency`, 等 |
| `data_type` | 字符串 | 数据类型 | 是 | `temporal`, `numerical`, `categorical` |
| `role` | 字符串 | 在可视化中的作用 | 是 | `x`, `y`, `group`, `size`, `color` |

### 数据记录 (data)

`data` 数组包含实际的数据记录，每条记录是一个包含列名与值映射的对象：

```json
"data": [
  {
    "Time Period": "'76-'79",
    "Binary": 1,
    "Status": "Still active"
  },
  {
    "Time Period": "'80-'89",
    "Binary": 7,
    "Status": "Ended"
  },
  // 更多数据记录...
]
```

## 完整示例

以下是一个符合规范的完整输入数据示例：

```json
{
  "metadata": {
    "title": "The United States of Emergency",
    "description": "Number of national emergencies declared in the United States since 1976, by current status",
    "main_insight": "The number of national emergencies declared in the US has generally increased over time, with a significant number of those declared since 2000 still active."
  },
  "data": {
    "columns": [
      {
        "name": "Time Period",
        "importance": "primary",
        "description": "Time periods of national emergencies declared",
        "unit": "none",
        "data_type": "temporal",
        "role": "x"
      },
      {
        "name": "Binary",
        "importance": "primary",
        "description": "Binary for the corresponding status",
        "unit": "none",
        "data_type": "numerical",
        "role": "y"
      },
      {
        "name": "Status",
        "importance": "primary",
        "description": "The status of the data point",
        "unit": "none",
        "data_type": "categorical",
        "role": "group"
      }
    ],
    "data": [
      {
        "Time Period": "'76-'79",
        "Binary": 1,
        "Status": "Still active"
      },
      {
        "Time Period": "'80-'89",
        "Binary": 7,
        "Status": "Ended"
      },
      {
        "Time Period": "'90-'99",
        "Binary": 6,
        "Status": "Still active"
      },
      {
        "Time Period": "'90-'99",
        "Binary": 14,
        "Status": "Ended"
      },
      {
        "Time Period": "'00-'09",
        "Binary": 11,
        "Status": "Still active"
      },
      {
        "Time Period": "'00-'09",
        "Binary": 5,
        "Status": "Ended"
      },
      {
        "Time Period": "'10-'19",
        "Binary": 15,
        "Status": "Still active"
      },
      {
        "Time Period": "'10-'19",
        "Binary": 3,
        "Status": "Ended"
      },
      {
        "Time Period": "'20-'22",
        "Binary": 8,
        "Status": "Still active"
      },
      {
        "Time Period": "'20-'22",
        "Binary": 1,
        "Status": "Ended"
      }
    ]
  }
}
```

## 数据验证

框架在处理输入数据之前会执行验证，确保数据符合上述格式要求。如果发现格式问题，框架将输出详细的错误消息指明问题所在。 