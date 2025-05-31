# 图表模板实现引擎 (chart_engine)

图表模板实现引擎（`chart_engine`）是 ChartPipeline 框架的第七个处理环节，负责基于前面模块的输出，生成图表的 SVG 表示。

## 功能简介

本模块将前序模块提供的图表类型、数据洞察、布局、配色和图像资源等配置信息转换为可视化图表。核心功能包括：

- 支持多种渲染引擎：ECharts (Python/JavaScript) 和 D3.js
- 提供统一的SVG输出格式
- 基于模板系统实现多种图表类型
- 支持递归扫描的模板目录，可以轻松添加新图表类型

## 输入与输出

### 输入

模块接收完整的JSON数据对象，包含所有前述模块的输出：

- `data`: 原始数据和结构信息
- `chart_type`: 图表类型推荐
- `datafacts`: 数据洞察
- `layout`: 布局和变体配置（这里不需要考虑布局，专注于绘制chart）
- `colors`: 配色方案
- `images`: 图像和图标资源

### 输出

模块输出一个包含图表 SVG 的 JSON 字段：

```json
{
  "chart_svg": "<svg width=\"800\" height=\"500\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

SVG 输出包含完整的图表可视化，包括：

- 数据标记和系列
- 坐标轴和网格线
- 图例和标签
- 交互元素（如提示框）
- 注释和高亮

## 模板系统

### 目录结构

```
modules/chart_engine/
├── template/
│   ├── echarts_py/    # Python生成的ECharts配置模板
│   ├── echarts-js/    # ECharts JavaScript模板
│   └── d3-js/         # D3.js模板
```

### 模板要求格式

每个模板文件必须包含一个特定格式的要求声明：

```
REQUIREMENTS_BEGIN
{
    "chart_type": "图表类型名称",        # 必需：用于模板匹配
    "chart_name": "图表标识符",          # 可选：唯一标识符
    "required_fields": ["x", "y", ...],  # 可选：必需的数据字段
    "required_fields_type": ["string", "number", ...], # 可选：字段类型
    "width": [500, 1000],                # 可选：宽度范围
    "height": [300, 600]                 # 可选：高度范围
}
REQUIREMENTS_END
```

### 支持的模板类型

1. **echarts_python模板**
   - `.py`文件，实现`make_options(json_data)`函数
   - 返回ECharts配置对象

2. **ECharts-JavaScript模板**
   - `.js`文件，实现`makeOption(jsonData)`函数
   - 返回ECharts配置对象

3. **D3.js模板**
   - `.js`文件，实现`makeChart(containerSelector, jsonData)`函数

### 模板注册过程

- 模板放入对应目录后自动注册，无需手动配置
- 系统启动时自动递归扫描模板目录及其子目录
- 基于REQUIREMENTS_BEGIN/END块解析模板元数据
- 根据chart_type和引擎类型进行模板匹配

## 使用与测试

### 命令行使用

```bash
cd modules/chart_engine
python make_svg.py
```

默认情况下，程序会：
1. 读取`input.json`文件作为输入数据
2. 根据数据确定图表类型
3. 查找最匹配的图表模板
4. 生成SVG并保存到`tmp/`目录

### 测试自定义模板

1. 准备测试数据：
   - 修改`input.json`包含所需数据和图表类型

2. 创建新模板：
   - 在适当的模板目录创建文件（如`echarts_py/my_chart.py`）
   - 添加REQUIREMENTS_BEGIN/END声明
   - 实现必要的函数（如`make_options`）

3. 运行测试：
   ```bash
   python make_svg.py
   ```

4. 检查结果：
   - 查看生成的SVG文件（位于`tmp/`目录）
   - 检查日志输出以确认使用了正确的模板

### 调试

设置环境变量开启调试信息：

```bash
export DEBUG=True
python make_svg.py
```

## 使用示例

### 命令行调用

```bash
python -m modules.chart_engine.chart_engine --input input_data.json --output chart.svg
```

### 程序调用

```python
from modules.chart_engine.chart_engine import process

success = process(input='input_data.json', output='chart.svg')
if success:
    print("图表生成完成")
else:
    print("图表生成失败")
```

## 扩展指南

创建新的图表模板：

1. 选择合适的模板引擎（echarts_py、echarts-js或d3-js）
2. 在对应目录创建新文件，添加REQUIREMENTS_BEGIN/END声明
3. 实现必要的函数（如`make_options`）
4. 将模板放入正确目录后，系统会自动扫描并注册
5. 无需任何额外配置或手动注册步骤

