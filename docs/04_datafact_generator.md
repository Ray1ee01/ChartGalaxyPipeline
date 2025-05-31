# 数据洞察模块 (datafact_generator)

数据洞察模块（`datafact_generator`）是 ChartPipeline 框架的第二个处理环节，负责分析数据并提取关键洞察，用于增强可视化的信息价值。

## 功能简介

本模块通过统计分析和模式识别，从数据中提取有意义的洞察（datafacts），包括趋势、比例关系、显著差异、异常值等。这些洞察按重要性排序，可用于指导可视化设计和标注，强化数据叙事。

## 输入与输出

### 输入

模块接收包含 `chart_type` 字段的数据对象，主要关注：

- `data.columns`: 列定义
- `data.data`: 实际数据记录
- `chart_type`: 图表类型推荐结果

### 输出

模块向输入数据添加 `datafacts` 字段，结构如下：

```json
{
  "datafacts": [
    {
      "type": "trend",
      "subtype": "increase",
      "data_points": [
        {
          "emergency_count": "1",
          "status": "active",
          "year": "1976"
        },
        {
          "emergency_count": "15",
          "status": "active",
          "year": "2022"
        }
      ],
      "score": 0.95,
      "annotation": "紧急状态宣布数量总体呈上升趋势",
      "reason": "从1976年至2022年，每十年宣布的国家紧急状态总数从1个增长到平均每十年超过15个"
    },
    {
      "type": "proportion",
      "subtype": "majority",
      "data_points": [
        {
          "emergency_count": "15",
          "status": "active",
          "year": "2019"
        },
        {
          "emergency_count": "3",
          "status": "ended",
          "year": "2019"
        }
      ],
      "score": 0.92,
      "annotation": "2010年代83%的紧急状态仍然活跃",
      "reason": "在2010-2019期间宣布的18个紧急状态中，15个仍处于活跃状态，只有3个已结束"
    },
    {
      "type": "difference",
      "subtype": "maximum",
      "data_points": [
        {
          "emergency_count": "14",
          "status": "ended",
          "year": "1999"
        },
        {
          "emergency_count": "5",
          "status": "ended",
          "year": "1989"
        }
      ],
      "score": 0.88,
      "annotation": "90年代结束的紧急状态最多",
      "reason": "1990-1999年期间有14个紧急状态被结束，比1980年代的5个增加了9个，是所有时期中最高的"
    },
    {
      "type": "trend",
      "subtype": "decrease",
      "data_points": [
        {
          "emergency_count": "3",
          "status": "ended",
          "year": "2022"
        }
      ],
      "score": 0.85,
      "annotation": "结束的紧急状态比例逐年减少",
      "reason": "从1980年代的100%结束率到2020年代仅11%的结束率，显示出明显下降趋势"
    },
    {
      "type": "value",
      "subtype": "total",
      "data_points": [
        {
          "emergency_count": "41",
          "status": "active",
          "year": "2022"
        }
      ],
      "score": 0.82,
      "annotation": "总计41个紧急状态仍然活跃",
      "reason": "所有时期加总，仍处于活跃状态的紧急状态数量为41个，远高于已结束的30个"
    }
  ]
}
```

每个数据洞察包含以下字段：

| 字段 | 类型 | 描述 |
|------|------|------|
| `type` | 字符串 | 洞察类型 |
| `subtype` | 字符串 | 洞察的具体子类型 |
| `data_points` | 对象数组 | 该洞察涉及的具体数据点，每个数据点包含多个列的值 |
| `score` | 浮点数 | 重要性评分（0-1） |
| `annotation` | 字符串 | 简短的洞察描述，适合作为图表标注 |
| `reason` | 字符串 | 详细的解释和支持该洞察的数据依据 |

## 支持的洞察类型和子类型

模块能够识别以下类型的数据洞察及其子类型：

- **trend（趋势）**
  - increase: 上升趋势
  - decrease: 下降趋势
  - stable: 稳定趋势
  - increase_then_decrease: 先升后降
  - increase_then_decrease: 先降后升
- **proportion（比例）**
  - value_majority: 单个样本多数
  - value_minority: 单个样本少数
  - total_majority: 样本总和多数
  - total_minority: 样本总和少数
- **difference（差异）**
  - maximum_large: 最大值较大
  - maximum_small: 最大值较小
  - minimum_large: 最小值较大
  - minimum_small: 最小值较小
  - average_large: 平均值较大
  - average_small: 平均值较小
  - sudden_increase: 时序数据陡增
  - sudden_decrease: 时序数据陡降
  - sudden_change: 类别数据差异明显
- **value（数值）**
  - total: 总和
  - average: 平均值
  - maximum: 最大值
  - minimum: 最小值
- **correlation（相关性）**
  - positive: 正相关
  - negative: 负相关

## 适应图表类型

模块考虑推荐的图表类型，优先提取与该类型最相关的洞察。例如：
- 对于趋势图表，重点识别趋势和变化
- 对于比较图表，重点识别差异和对比
- 对于分布图表，重点识别分布特征和异常值

## 使用示例

### 命令行调用

```bash
python -m modules.datafact_generator.datafact_generator --input input_data.json --output output_data.json
```

### 程序调用

```python
from modules.datafact_generator.datafact_generator import process

success = process(input_data='input_data.json', output='output_data.json')
if success:
    print("数据洞察生成完成")
else:
    print("数据洞察生成失败")
```

## 常见问题

**Q: 如何控制生成的洞察数量？**  
A: 模块默认返回评分最高的5个洞察，可以通过修改模块参数调整数量。

**Q: 洞察是如何排序的？**  
A: 洞察按评分（score）从高到低排序，评分反映该洞察的重要性和显著性。

**Q: 如何处理小数据集？**  
A: 对于小数据集，模块会调整统计方法以避免过度解读，并相应降低置信度。 