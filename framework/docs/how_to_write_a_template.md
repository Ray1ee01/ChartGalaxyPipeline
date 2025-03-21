# How to Write a Chart Template

This guide explains how to create new chart templates for the ECharts SVG Rendering Framework. The framework supports multiple template types (ECharts Python, ECharts JavaScript, and D3.js), and uses a template system to render various chart types.

## Template Types

The framework supports three types of templates:

1. **ECharts Python Templates** (`echarts-py/`): Python modules that generate ECharts options
2. **ECharts JavaScript Templates** (`echarts-js/`): JavaScript files that create ECharts instances
3. **D3.js Templates** (`d3-js/`): JavaScript files that create D3.js charts

## Template Requirements

All templates must include a requirements section at the beginning of the file. This section defines metadata for the template and specifies the data requirements.

### Requirements Format

The requirements section must follow this exact structure:

```
REQUIREMENTS_BEGIN
{
    "chart_type": "Your Chart Type",
    "chart_name": "unique_chart_name",
    "is_composite": false,
    "required_fields": ["field1", "field2"],
    "required_fields_type": [["numerical", "categorical"], ["numerical"]],
    "required_fields_range": [[1, 10], [5, 100]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary", "man"],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 300,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
```

### Key Requirements Fields

注意：requirement字段仅为描述用途，所有的信息都是关于你的template的描述信息。你不需要根据里面的值决定你的绘制。

| Field | Description | Example |
|-------|-------------|---------|
| `chart_type` | 图表类型，用于模板选择 | `"Bar Chart"` |
| `chart_name` | 模板的唯一标识符 | `"simple_bar_chart_01"` |
| `is_composite` | 是否为复合图表 | `false` |
| `required_fields` | 图表所需的数据字段数组<br>- 如果`is_composite=false`，是一维数组<br>- 如果`is_composite=true`，是二维数组 | 普通：`["x", "y", "group"]`<br>复合：`[["x", "y"], ["x", "y2"]]` |
| `required_fields_type` | 每个字段允许的数据类型<br>- 二维数组，每个字段可以有多种可选类型<br>- 如果`is_composite=true`，是三维数组 | 普通：`[["categorical"], ["numerical"], ["categorical"]]`<br>复合：`[[["categorical"], ["numerical"]], [["categorical"], ["numerical"]]]` |
| `required_fields_range` | 字段值的范围限制<br>- 对于numerical类型，限制数值范围<br>- 对于categorical/temporal类型，限制不同值的数量 | `[[1, 10], [5, 100]]` |
| `required_fields_icons` | 指定需要为哪些字段提供图标，与required_fields中的字段对应 | `["x"]` |
| `required_other_icons` | 需要的其他图标<br>- 使用`primary`表示主题相关图标<br>- 使用具体名称表示特定图标 | `["primary", "man"]` |
| `required_fields_colors` | 指定需要为哪些字段提供颜色 | `["x"]` |
| `required_other_colors` | 需要的其他颜色，使用具体名称表示特定的颜色需求。`primary`表示chart的主题色，`secondary`表示composite chart中的第二种颜色（一般用不到） | `["primary", "secondary"]` |
| `supported_effects` | 模板支持的视觉效果，只列出实际实现的效果 | `["shadow", "radius_corner"]` |
| `min_height` | 图表的最小高度（像素） | `300` |
| `min_width` | 图表的最小宽度（像素） | `400` |
| `background` | 数据可视化区域的背景风格<br>- `no`: 没有<br>- `styled`: 具有条纹、网格线或参考线 | `"no"` |
| `icon_mark` | 如何在可视化中使用小图标与数据标记<br>- `overlay`: 小图标放置在mark上（例如，条形顶部的图标）<br>- `replace`: 使用图标代替mark（例如，用堆叠的图标表示条形）<br>- `side`: 图标放置在数据标记旁边进行注释<br>- `none`: 没有使用图标与标记 | `"none"` |
| `icon_label` | 如何将图标集成到坐标轴标签中<br>- `side`: 图标与坐标轴文本结合使用（例如，国家名称前的国旗）<br>- `replace`: 使用图标代替文本标签<br>- `none`: 纯文本标签，没有图标 | `"none"` |
| `has_x_axis` | 图表是否显示X轴<br>- `yes`: 显示X轴<br>- `no`: 不显示X轴 | `"yes"` |
| `has_y_axis` | 图表是否显示Y轴<br>- `yes`: 显示Y轴<br>- `no`: 不显示Y轴 | `"yes"` |

### 图标使用说明

在模板代码中，可以通过以下方式获取图标：

1. **字段相关图标**：通过`dataJson["images"]["field"][value]`获取，格式为base64的ImageUrl
   ```javascript
   // 直接获取字段图标
   // 假定required_fields_icons = ["x"], 而x的取值包括US和China
   const usIcon = dataJson.images.field["US"];
   const chinaIcon = dataJson.images.field["China"];
   ```

2. **其他图标**：通过`dataJson["images"]["other"][iconName]`获取，格式为base64的ImageUrl
   ```javascript
   // 直接获取其他图标
   // 假定required_other_icons = ["primary", "man"]
   const topicIcon = dataJson.images.other["primary"];
   const manIcon = dataJson.images.other["man"];
   ```

在template的requirements中指定了`required_fields_icons`和`required_other_icons`后，框架会保证这些图标在input data中可用，无需进行错误处理或提供默认值。

### 颜色使用说明

在模板代码中，可以通过以下方式获取颜色：

1. **字段相关颜色**：通过`dataJson["colors"]["field"][value]`获取，为颜色代码值（如"#FF0000"或"red"）
   ```javascript
   // 直接获取颜色
   // 假定required_fields_colors = ["x"], 而x的取值包括US和China
   const usColor = dataJson.colors.field["US"];
   const chinaColor = dataJson.colors.field["China"];
   ```

2. **其他颜色**：通过`dataJson["colors"]["other"]`获取，为颜色代码值
   ```javascript
   // 直接获取颜色
   // 假定required_other_colors = ["primary", "secondary"]
   const primaryColor = dataJson.colors.other.primary;
   const secondaryColor = dataJson.colors.other.secondary;
   ```

3. **其他通用颜色**：可以通过`dataJson["colors"]["available_colors"]`获取可用的颜色数组
   ```javascript
   // 获取颜色数组
   const availableColors = dataJson.colors.available_colors;
   const firstColor = availableColors[0]; // 第一个可用颜色
   ```

4. **背景和文本颜色**：通过`dataJson["colors"]`中的相应字段获取
   ```javascript
   // 直接获取颜色
   const backgroundColor = dataJson.colors.background_color;
   const textColor = dataJson.colors.text_color;
   ```

在template的requirements中指定了`required_fields_colors`和`required_other_colors`后，框架会保证这些颜色在input data中可用，无需进行错误处理或提供默认值。

### 复合图表说明

如果`is_composite`设置为`true`，表示这是一个复合图表，需要注意：

1. `required_fields`变为二维数组，每个子数组表示一个子图表所需的字段
2. `required_fields_type`变为三维数组，结构为`[子图表][字段][类型]`
3. `required_fields`内的变量符号不要重名。如果重名，则表示这是相同的列（例如都是Country）。

例如，一个组合了柱状图和折线图的复合图表可能这样定义：

```json
{
    "is_composite": true,
    "required_fields": [["category", "value1"], ["category", "value2"]],
    "required_fields_type": [
        [["categorical"], ["numerical"]],
        [["categorical"], ["numerical"]]
    ],
    "required_fields_range": [
        [[3, 10], [0, 100]],
        [[3, 10], [0, 100]]
    ]
}
```

## Template Directory Structure

Templates should be placed in the appropriate directory based on their type:

```
template/
├── d3-js/              # D3.js templates
│   └── examples/       # Example templates
├── echarts-js/         # ECharts JavaScript templates
│   └── examples/       # Example templates
└── echarts-py/         # Python templates
    └── examples/       # Example templates
```

You can organize templates in subdirectories if needed - the system will recursively scan for templates.

## Creating a D3.js Template

Here's a step-by-step guide to creating a simple D3.js bar chart template:

1. Create a new JavaScript file in the `template/d3-js/` directory (or subdirectory)
2. Add the requirements section at the top of the file
3. Implement the `makeChart` function that renders the chart

### Example: Simple Bar Chart Template

```javascript
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Simple Bar Chart",
    "chart_name": "simple_bar_chart_d3",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 10], [0, 1000]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 300,
    "min_width": 400,
    "background": "no",
    "icon_mark": "overlay",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// Simple Bar Chart implementation using D3.js
function makeChart(containerSelector, data) {
    // Extract data from the json_data object
    const jsonData = data;
    const chartData = jsonData.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    
    // Clear any existing content
    d3.select(containerSelector).html("");
    
    // Set width and height based on variables
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Extract axis fields
    const xField = variables.x_axis.field;
    const yField = variables.y_axis.field;
    
    // Create SVG inside the container
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // Create chart group and apply margin
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Create scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d[xField]))
        .range([0, innerWidth])
        .padding(0.3);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
        .range([innerHeight, 0]);

    // Add shadow filter if needed
    if (variables.mark.has_shadow) {
        const defs = svg.append("defs");
        
        defs.append("filter")
            .attr("id", "shadow")
            .append("feDropShadow")
            .attr("dx", 0)
            .attr("dy", 2)
            .attr("stdDeviation", 2)
            .attr("flood-opacity", 0.3);
    }
    
    // Add gradient if needed
    if (variables.mark.has_gradient) {
        const defs = svg.select("defs").size() ? svg.select("defs") : svg.append("defs");
        
        const gradient = defs.append("linearGradient")
            .attr("id", "bar-gradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", innerHeight);
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(variables.color.mark_color.range[0]).brighter(0.5));
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", variables.color.mark_color.range[0]);
    }
    
    // Get icons
    const icons = jsonData.images.field;
    
    // Draw bars
    g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d[xField]))
        .attr("y", d => yScale(d[yField]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d[yField]))
        .attr("fill", d => colors.field[d[xField]])
        .attr("rx", variables.mark.has_rounded_corners ? 4 : 0)
        .attr("ry", variables.mark.has_rounded_corners ? 4 : 0)
        .style("stroke", variables.mark.has_stroke ? colors.stroke_color : "none")
        .style("stroke-width", variables.mark.has_stroke ? 1 : 0)
        .style("filter", variables.mark.has_shadow ? "url(#shadow)" : "none");
    
    // Always draw x-axis
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
    
    // Style the domain and ticks based on variables
    if (!variables.x_axis.has_domain) {
        xAxis.select(".domain").remove();
    }
    
    if (!variables.x_axis.has_tick) {
        xAxis.selectAll(".tick line").remove();
    }
    
    // Apply typography to x-axis labels
    xAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end");
    
    // Always draw y-axis
    const yAxis = g.append("g")
        .call(d3.axisLeft(yScale))
    
    // Style the domain and ticks based on variables
    if (!variables.y_axis.has_domain) {
        yAxis.select(".domain").remove();
    }
    
    if (!variables.y_axis.has_tick) {
        yAxis.selectAll(".tick line").remove();
    }
    
    // Apply typography to y-axis labels
    yAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight);
    
    // Add icons to x-axis
    chartData.forEach(d => {
        const xValue = d[xField];
        if (icons[xValue]) {
            g.append("image")
                .attr("x", xScale(xValue) + xScale.bandwidth() / 2 - 10)
                .attr("y", innerHeight + 25)
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", icons[xValue]);
        }
    });
    
    return svg.node();
}
```

## 更简单的D3.js条形图示例

这里是一个更简化的D3.js条形图模板示例，专注于基本功能：

```javascript
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Simple Bar Chart",
    "chart_name": "minimal_bar_chart",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 8], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 200,
    "min_width": 300,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const chartData = data.data;
    const variables = data.variables;
    const typography = data.typography;
    const colors = data.colors;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 30, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = variables.x_axis.field;
    const yField = variables.y_axis.field;
    
    // 获取颜色
    const barColor = colors.other.primary;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 创建比例尺
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d[xField]))
        .range([0, innerWidth])
        .padding(0.2);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField])])
        .range([innerHeight, 0]);
    
    // 绘制条形
    g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d[xField]))
        .attr("y", d => yScale(d[yField]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d[yField]))
        .attr("fill", barColor);
    
    // 绘制X轴
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size);
    
    // 绘制Y轴
    g.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size);
    
    return svg.node();
}
```

## Creating an ECharts Python Template

ECharts Python templates follow a different structure:

1. Add the requirements section at the top
2. Implement a `make_options` function that returns ECharts options

Example structure:

```python
'''
REQUIREMENTS_BEGIN
{
    "chart_type": "Bar Chart",
    "chart_name": "simple_bar_chart_py",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 10], [0, 1000]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": ["shadow"],
    "min_height": 300,
    "min_width": 400,
    "background": "styled",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
'''

def make_options(json_data):
    # 提取数据
    chart_data = json_data['data']
    variables = json_data['variables']
    colors = json_data['colors']
    
    # 提取字段名
    x_field = variables['x_axis']['field']
    y_field = variables['y_axis']['field']
    
    # 准备数据
    x_data = [item[x_field] for item in chart_data]
    y_data = [item[y_field] for item in chart_data]
    
    # 获取图标
    icons = json_data['images']['field']
    
    # 获取颜色信息
    field_colors = colors['field']
    primary_color = colors['other']['primary']
    secondary_color = colors['other']['secondary']
    
    # 创建ECharts选项
    options = {
        'xAxis': {
            'type': 'category',
            'data': x_data,
            'axisLabel': {
                'rotate': 45 if len(x_data) > 5 else 0
            }
        },
        'yAxis': {
            'type': 'value'
        },
        'series': [{
            'data': [],
            'type': 'bar',
            'itemStyle': {
                'color': primary_color,
                'shadowBlur': 10 if variables['mark'].get('has_shadow', False) else 0,
                'shadowColor': 'rgba(0, 0, 0, 0.3)' if variables['mark'].get('has_shadow', False) else 'transparent'
            }
        }]
    }
    
    # 为每个数据点指定颜色
    data_with_color = []
    for i, value in enumerate(y_data):
        x_value = x_data[i]
        data_item = {
            'value': value
        }
        # 如果字段值有特定颜色，则应用
        if x_value in field_colors:
            data_item['itemStyle'] = {'color': field_colors[x_value]}
        data_with_color.append(data_item)
    
    options['series'][0]['data'] = data_with_color
    
    return options
```

## 复合图表示例

下面是一个简单的复合图表示例，展示如何定义具有多个子图表的模板：

```javascript
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bar Line Composite Chart",
    "chart_name": "bar_line_composite",
    "is_composite": true,
    "required_fields": [["category", "value1"], ["category", "value2"]],
    "required_fields_type": [
        [["categorical"], ["numerical"]],
        [["categorical"], ["numerical"]]
    ],
    "required_fields_range": [
        [[3, 10], [0, 100]],
        [[3, 10], [0, 100]]
    ],
    "required_fields_icons": ["category"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["category"],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 400,
    "min_width": 500,
    "background": "styled",
    "icon_mark": "side",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 实现复合图表逻辑...
    // 第一部分数据用于条形图
    // 第二部分数据用于折线图
    // ...
}
```

## Template Registration

Templates are automatically registered when the framework starts up. The system scans the template directories and builds a registry based on the requirements sections.

The template registry matches chart types to the appropriate template based on:
1. Exact chart type match
2. Partial matches if no exact match is found
3. Engine preference order (default: Python -> JavaScript -> D3.js)

## Expected Input Format

Templates receive a JSON object with the following structure:

```json
{
    "data": [
        {"category": "A", "value": 10},
        {"category": "B", "value": 15},
        {"category": "C", "value": 8}
    ],
    "data_columns": [
        {"name": "category", "role": "dimension"}, 
        {"name": "value", "role": "measure"}
    ],
    "variables": {
        "width": 800,
        "height": 500,
        "color": {
            "mark_color": {
                "domain": ["A", "B", "C"],
                "range": ["#5470c6", "#91cc75", "#fac858"]
            },
            "stroke_color": "#ffffff",
            "text_color": "#333333"
        },
        "x_axis": {
            "field": "category",
            "style": {
                "color": "#666666",
                "opacity": 0.8
            },
            "has_domain": true,
            "has_tick": true
        },
        "y_axis": {
            "field": "value",
            "style": {
                "color": "#666666",
                "opacity": 0.8
            },
            "has_domain": true,
            "has_tick": true
        },
        "mark": {
            "has_shadow": true,
            "has_gradient": false,
            "has_rounded_corners": true,
            "has_stroke": true,
            "has_spacing": true
        },
        "title": {
            "text": "Simple Bar Chart"
        }
    },
    "typography": {
        "title": {
            "font_family": "Arial, sans-serif",
            "font_size": "16px",
            "font_weight": "bold"
        },
        "label": {
            "font_family": "Arial, sans-serif",
            "font_size": "12px",
            "font_weight": "normal"
        },
        "annotation": {
            "font_family": "Arial, sans-serif",
            "font_size": "10px",
            "font_weight": "normal"
        }
    },
    "images": {
        "field": {
            "A": "data:image/svg+xml;base64,...",
            "B": "data:image/svg+xml;base64,..."
        },
        "other": {
            "primary": "data:image/svg+xml;base64,...",
            "man": "data:image/svg+xml;base64,..."
        }
    },
    "colors": {
        "field": {
            "A": "#FF5733",
            "B": "#33FF57",
            "C": "#3357FF"
        },
        "other": {
            "primary": "#E63946",
            "secondary": "#457B9D"
        },
        "available_colors": ["#A9D700", "#FFD700", "#008080", "#4B0082"],
        "background_color": "#FFFFFF",
        "text_color": "#1D3557"
    }
}
```

## Best Practices

1. **Keep templates focused**: 每个模板应只处理一种特定图表类型
2. **Support visual variations**: 实现常见的视觉效果（阴影、渐变等）
3. **Handle edge cases**: 处理边缘情况，如空数据、数据点不足等
4. **Use appropriate defaults**: 为所有视觉属性提供合理的默认值
5. **Document requirements clearly**: 确保需求部分完整准确
6. **Test with various data**: 使用不同形状和大小的数据验证模板

## Testing Your Template

1. 将模板放入相应目录
2. 创建测试JSON输入文件
3. 运行框架：`python make_svg.py --input your_test_input.json`
4. 在`tmp/`目录中验证SVG输出

## Troubleshooting

- 如果找不到模板，检查requirements部分格式是否正确
- 验证requirements中的chart_type是否与输入中请求的类型匹配
- 检查控制台输出中的错误信息
- 对于D3.js模板，确保正确实现了`makeChart`函数
- 对于Python模板，确保`make_options`函数返回有效的ECharts选项
