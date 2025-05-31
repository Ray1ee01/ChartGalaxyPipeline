# 图像推荐模块 (image_recommender)

图像推荐模块（`image_recommender`）是 ChartPipeline 框架的第六个处理环节，负责推荐与图表内容相关的图像和图标元素。

## 功能简介

本模块基于数据内容、主题和视觉设计需求，为可视化推荐相关的图像和图标元素。适当的图像可以增强数据叙事，提供上下文信息，增加视觉吸引力，并帮助用户更好地理解和记忆数据。模块通过智能匹配和筛选，推荐最适合当前数据和主题的视觉元素。

## 输入与输出

### 输入

模块接收包含以下字段的数据对象：

- `chart_type`: 图表类型推荐
- `datafacts`: 数据洞察
- `titles`: 生成的标题和副标题
- `layout`: 布局和变体配置
- `colors`: 配色方案

### 输出

模块向输入数据添加 `images` 字段，结构如下：

```json
{
  "images": {
      "field": {
            "Still active": "data:image/svg+xml;base64,...",
            "Ended": "data:image/svg+xml;base64,...",
            "Time Period": "data:image/svg+xml;base64,...",
            "Status": "data:image/svg+xml;base64,..."
      },
      "other": {
            "primary": "data:image/svg+xml;base64,...",
            "man": "data:image/svg+xml;base64,...",
            "us_flag": "base64_encoded_image_data_for_us_flag"
      }
  }
}
```

### 图像字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `field` | 对象 | 数据标记/标签图标，键为数据类别或值，值为对应的图像数据 |
| `other` | 对象 | 其他必要图像，如背景、装饰或主题相关图像 |

## 图像类型和功能

模块支持多种类型的图像元素，每种具有不同的功能：

1. **数据标记图标**
   - 替代或增强常规数据点标记
   - 通过图标形状直观表达数据类别
   - 增加图表的辨识度和趣味性

2. **标签和轴图标**
   - 增强坐标轴标签的视觉表达
   - 提供数据类别的直观识别
   - 减少文本阅读负担

3. **背景和装饰图像**
   - 提供主题相关的视觉上下文
   - 增强整体设计美感
   - 创建情感联系和记忆点

4. **辅助解释图像**
   - 提供对数据的补充说明
   - 显示相关物理对象或概念
   - 增强数据叙事的说服力

## 图像推荐策略

模块使用以下策略推荐最合适的图像：

1. **主题匹配**
   - 基于数据主题和内容关键词匹配相关图像
   - 考虑元数据中的描述和标题

2. **情感一致性**
   - 匹配图像的情感基调与数据洞察的情感
   - 避免视觉元素与数据叙事产生冲突

3. **视觉协调性**
   - 选择与配色方案协调的图像
   - 确保图像风格统一，避免视觉混乱

4. **功能适配性**
   - 根据布局和图表类型选择合适尺寸和方向的图像
   - 针对不同的使用场景选择适当的详细程度

## 使用示例

### 命令行调用

```bash
python -m modules.image_recommender.image_recommender --input input_data.json --output output_data.json
```

### 程序调用

```python
from modules.image_recommender.image_recommender import process

success = process(input='input_data.json', output='output_data.json')
if success:
    print("图像推荐完成")
else:
    print("图像推荐失败")
```
