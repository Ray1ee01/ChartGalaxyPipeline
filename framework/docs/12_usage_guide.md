# ChartPipeline 使用指南

本指南将帮助您快速上手 ChartPipeline 框架，了解如何安装、配置和使用该工具生成高质量的数据可视化。

## 目录
- [安装](#安装)
- [基本使用](#基本使用)
- [进阶使用](#进阶使用)
- [常见问题](#常见问题)
- [故障排除](#故障排除)

## 安装

### 系统要求
- Python 3.8 或更高版本
- 建议使用 Linux 或 macOS，Windows 也支持

### 安装步骤

1. 克隆代码库：
   ```bash
   git clone https://github.com/yourusername/ChartPipeline.git
   cd ChartPipeline
   ```

2. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```

3. 验证安装：
   ```bash
   python -m pipeline --help
   ```

## 基本使用

ChartPipeline 可以通过以下方式使用：

### 1. 完整管道处理

使用 `pipeline.py` 脚本执行整个数据可视化生成流程：

```bash
python pipeline.py --input data.json --output chart.svg
```

这将依次执行所有模块，将 `data.json` 转换为 `chart.svg`。

### 2. 单模块处理

您也可以单独调用特定模块：

```bash
# 图表类型推荐
python -m modules.chart_type_recommender.chart_type_recommender --input data.json --output data_with_chart_type.json

# 数据洞察生成
python -m modules.datafact_generator.datafact_generator --input data_with_chart_type.json --output data_with_insights.json

# 其他模块类似...
```

### 3. 编程方式使用

在您自己的 Python 代码中使用：

```python
from pipeline import run_pipeline

success = run_pipeline(
    input_path='data.json',
    output_path='output.svg',
    temp_dir='tmp'
)

if success:
    print("可视化生成成功！")
```

## 数据准备

ChartPipeline 需要特定格式的 JSON 输入文件。以下是创建有效输入的指南：

### 输入文件结构

输入 JSON 应包含两个主要部分：`metadata` 和 `data`：

```json
{
  "metadata": {
    "title": "图表标题",
    "description": "图表描述",
    "main_insight": "主要洞察"
  },
  "data": {
    "columns": [
      {
        "name": "列名",
        "importance": "primary",
        "description": "列描述",
        "unit": "单位",
        "data_type": "数据类型",
        "role": "在图表中的角色"
      },
      // 更多列定义...
    ],
    "data": [
      {
        "列名1": 值1,
        "列名2": 值2,
        // ...
      },
      // 更多数据行...
    ]
  }
}
```

参考 [输入数据格式](./02_input_data_format.md) 获取详细规范。

### 示例数据

框架附带了几个示例数据文件，您可以作为参考：

```bash
# 使用示例数据生成图表
python pipeline.py --input examples/time_series/national_emergencies.json --output emergencies_chart.svg
```

## 进阶使用

### 自定义模块执行

您可以选择仅执行部分模块：

```bash
python pipeline.py --input data.json --output chart.svg --modules chart_type_recommender,datafact_generator,title_generator,chart_engine
```

### 临时文件存储

管理临时文件的位置：

```bash
python pipeline.py --input data.json --output chart.svg --temp-dir ./my_temp_folder
```

### 配置文件

通过配置文件自定义框架行为：

1. 创建配置文件 `config.yaml`：
   ```yaml
   chart_type_recommender:
     max_recommendations: 3
     
   datafact_generator:
     max_facts: 5
     
   color_recommender:
     color_blind_friendly: true
     
   # 其他模块配置...
   ```

2. 应用配置：
   ```bash
   python pipeline.py --input data.json --output chart.svg --config config.yaml
   ```

## 输出格式

ChartPipeline 默认输出 SVG 格式，但也支持转换为其他格式：

```bash
# 导出为 PNG
python pipeline.py --input data.json --output chart.png --format png

# 导出为 PDF
python pipeline.py --input data.json --output chart.pdf --format pdf
```

## 自定义和扩展

### 添加新图表类型

1. 在 `modules/chart_engine/templates/` 目录下创建新模板文件
2. 在 `modules/chart_engine/chart_engine.py` 中注册新图表类型
3. 在 `modules/chart_type_recommender/chart_type_recommender.py` 中添加新图表类型的推荐逻辑

## 故障排除

### 常见错误

1. **输入数据格式错误**
   - 检查 JSON 文件格式是否符合要求
   - 验证所有必需字段是否存在

2. **模块导入错误**
   - 确认已安装所有依赖项
   - 检查 Python 环境路径是否正确

3. **SVG 渲染问题**
   - 确保系统安装了必要的图形库
   - 检查生成的 SVG 文件语法是否正确

### 日志和调试

启用详细日志以帮助诊断问题：

```bash
python pipeline.py --input data.json --output chart.svg --log-level debug
```

日志文件默认保存在 `logs/` 目录中。

## 性能优化

提高处理大型数据集的速度：

1. 使用 PyPy 代替 CPython 运行框架
2. 启用多进程模式：`--parallel true`
3. 对输入数据进行预处理和优化
4. 考虑使用内存映射文件处理中间结果

## 社区和支持

- GitHub Issues: 报告 bug 和功能请求
- 文档: 完整的文档在 `docs/` 目录下
- 示例: 查看 `examples/` 目录获取示例用法 