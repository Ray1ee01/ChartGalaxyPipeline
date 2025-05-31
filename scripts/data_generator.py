import json
import os
import sys
import random
import re
import concurrent.futures
from typing import List, Dict, Tuple
from datetime import datetime
import threading
from tqdm import tqdm
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import api_key, base_url

# OpenAI API configuration
API_KEY = api_key
API_PROVIDER = base_url

# Column combinations
COLUMN_COMBINATIONS = [
    "categorical + numerical",
    "categorical + numerical + categorical",
    "categorical + numerical + numerical",
    "categorical + numerical + numerical + categorical",
    "temporal + numerical",
    "temporal + numerical + categorical",
    "categorical + numerical + temporal"
]

# Thread-safe print function
print_lock = threading.Lock()
def thread_safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

def query_llm(prompt: str) -> str:
    """
    Query LLM API with a prompt
    Args:
        prompt: The prompt to send to LLM
    Returns:
        str: The response from LLM
    """
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': 'gemini-2.0-flash',
        'messages': [
            {'role': 'system', 'content': 'You are a data visualization expert. Provide concise, specific answers.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.5,
        'max_tokens': 5000
    }
    
    try:
        response = requests.post(f'{API_PROVIDER}/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        thread_safe_print(f"Error querying LLM: {e}")
        return None

# Data facts dictionary
datafacts = {
    "trend": {
        "increase": "Increasing trend",
        "decrease": "Decreasing trend",
        "stable": "Stable trend",
        "increase_then_decrease": "Increase then decrease",
        "decrease_then_increase": "Decrease then increase",
        "fluctuation": "Fluctuating trend"
    },
    "proportion": {
        "majority": "Majority",
        "minority": "Minority"
    },
    "value": {
        "total": "Total",
        "average": "Average",
        "maximum": "Maximum",
        "minimum": "Minimum"
    },
    "comparison": {
        "average_higher": "Higher average value compared to others",
        "average_lower": "Lower average value compared to others",
        "significant_difference": "Significant difference compared to other categories"
    },
    "change": {
        "sudden_increase": "Significantly higher value compared to the previous value",
        "sudden_decrease": "Significantly lower value compared to the previous value",
    },
    "correlation": {
        "positive": "Positive correlation",
        "negative": "Negative correlation"
    },
    "rank": {
        "first": "First",
        "second": "Second",
        "third": "Third",
        "last": "Last"
    }
}

def load_themes(file_path: str) -> List[Dict]:
    """Load themes from JSON file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)
def generate_scenarios_for_theme(theme: Dict, num_scenarios: int = 5) -> List[str]:
    """Step 1: Generate specific scenarios for a given theme
    
    Args:
        theme: 主题字典
        num_scenarios: 要生成的场景数量,默认为5个
    """
    prompt = f"""As a data visualization expert, generate {num_scenarios} diverse and specific scenarios where charts about "{theme['theme']}" ({theme['description']}) would be valuable.

    REQUIREMENTS:
    - Each scenario must be concrete, specific, and realistic
    - Focus on business, research, policy, and educational contexts
    - Include diverse industries, regions, and use cases
    - Each scenario should be 15-25 words
    - Make each scenario distinctly different from others
    - Scenarios should represent practical visualization needs
    
    ANALYSIS OBJECT DIVERSITY REQUIREMENTS:
    - Each scenario must have a clear analysis object (what is being analyzed)
    - Ensure analysis objects vary across scenarios (countries, companies, technologies, demographics, etc.)
    - Different scenarios can have overlapping analysis objects, but should not be identical
    - For example, if one scenario analyzes "renewable energy usage in EU countries", another might analyze "renewable energy adoption by tech companies"
    
    FORMAT:
    Return a numbered list (1-{num_scenarios}) with one scenario per line. 
    DO NOT include any introductory or explanatory text.
    """
    
    response = query_llm(prompt)
    if not response:
        return []
    
    scenarios = []
    for line in response.split('\n'):
        line = line.strip()
        if line and (line[0].isdigit() or line.lower().startswith('- ')):
            scenario = line.lstrip('0123456789.- ').strip()
            if scenario:
                scenarios.append(scenario)
    
    return scenarios[:num_scenarios]

def select_relevant_datafacts(theme: Dict, scenario: str) -> List[Dict]:
    """Step 2: Select relevant datafacts for the theme and scenario"""
    # Convert datafacts to a flat list for easier processing
    flat_datafacts = []
    for category, facts in datafacts.items():
        for key, description in facts.items():
            flat_datafacts.append({
                "category": category,
                "key": key,
                "description": description
            })
    
    prompt = f"""As a data analysis expert, select the 5 most informative data facts that should be highlighted in a visualization for this scenario:

    THEME: {theme['theme']}
    SCENARIO: {scenario}
    
    TASK:
    Select exactly 5 data facts from the list below that would be most valuable to emphasize in this visualization. Choose a diverse set that together tells a compelling data story.
    
    AVAILABLE FACTS:
    {json.dumps(flat_datafacts, indent=2)}
    
    FORMAT:
    Return only a numbered list (1-5) with each selected fact and its category in this format:
    1. [Category]: [Description]
    
    DO NOT include any explanations or additional text.
    """
    
    response = query_llm(prompt)
    if not response:
        return []
    
    selected_facts = []
    for line in response.split('\n'):
        line = line.strip()
        if line:
            for fact in flat_datafacts:
                if fact['description'].lower() in line.lower():
                    selected_facts.append(fact)
                    break
    
    return selected_facts[:3]

def extract_json_from_response(response: str) -> str:
    """Extract JSON from LLM response using regex"""
    if not response:
        return "{}"
        
    # Try to find JSON content between triple backticks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
    if json_match:
        extracted = json_match.group(1).strip()
        return json.loads(extracted)
    
    # Try to find content that looks like a JSON object
    json_match = re.search(r'(\{[\s\S]*\})', response)
    if json_match:
        extracted = json_match.group(1).strip()
        return json.loads(extracted)
    
    # Return the original response if no JSON pattern found
    return response.strip()

def parse_json_safely(text: str) -> Dict:
    """Parse JSON from text safely with error handling"""
    if not text:
        thread_safe_print(f"Warning: Empty text to parse as JSON")
        return {}
        
    return extract_json_from_response(text)

def validate_generated_data(generated_data, column_recommendation):
    """验证生成的数据是否有效"""
    validation = {
        "is_valid": True,
        "issues": []
    }
    
    # 检查数据是否为空
    if not generated_data or "data" not in generated_data or not generated_data["data"]:
        validation["is_valid"] = False
        validation["issues"].append("Empty data array")
        return validation
    
    # 获取期望的列
    expected_columns = [col["name"] for col in column_recommendation.get("columns", [])]
    
    # 检查每行数据
    for i, row in enumerate(generated_data["data"]):
        # 检查是否包含所有列
        for col in expected_columns:
            if col not in row:
                validation["is_valid"] = False
                validation["issues"].append(f"Row {i} missing column '{col}'")
        
        # 检查数值列的数据类型
        for col in column_recommendation.get("columns", []):
            if col["name"] in row and col["data_type"] == "numerical":
                if not isinstance(row[col["name"]], (int, float)):
                    validation["is_valid"] = False
                    validation["issues"].append(f"Row {i}, column '{col['name']}' has non-numeric value: {row[col['name']]}")
    
    return validation

def recommend_columns(theme: Dict, scenario: str, selected_fact: Dict) -> Dict:
    """Step 3: Recommend column structure based on theme, scenario and selected facts"""
    facts_str = f"- {selected_fact['category']}: {selected_fact['description']}"
    
    prompt = f"""As a data visualization specialist, recommend the MOST APPROPRIATE column structure for this visualization:

    CONTEXT:
    - THEME: {theme['theme']}
    - SCENARIO: {scenario}
    - KEY DATA FACTS TO HIGHLIGHT:
    {facts_str}
    
    TASK:
    Carefully analyze the scenario and data facts, then select the most appropriate column combination based on what would create the most informative and clear visualization.
    
    COLUMN COMBINATION OPTIONS:
    - "categorical + numerical" (e.g., Countries and their GDP)
    - "categorical + numerical + numerical" (e.g., Products, Sales, and Profit margin)
    - "categorical + numerical + categorical" (e.g., Products, Revenue, and Categories)
    - "temporal + numerical" (e.g., Years and Growth rate)
    - "temporal + numerical + categorical" (e.g., Years, Performance, and Regions)
    - "categorical + numerical + temporal" (e.g., Countries, Scores, and Periods)
    
    CRITICAL CONSIDERATIONS:
    - Choose the SIMPLEST combination that effectively communicates the key insights
    - Complex combinations (with more columns) are NOT always better
    - "temporal + numerical" is often best for trend analysis over time
    - Only select "temporal + numerical + categorical" when comparing multiple categories over time
    - Ensure the combination makes logical sense for the scenario
    - Consider what will be most intuitive for users to understand
    
    COLUMN REQUIREMENTS:
    - Names must be clear, concise, and start with a capital letter
    - Descriptions must be specific and explain exact data meaning/context
    
    CATEGORICAL COLUMNS:
    - Use names like "Country", "Region", "Category", "Group", "Industry", etc.
    - More examples: "Year", "Response", "Company", "Category", "Party", "City", "Region", "Brand", "Team", "Generation", "Platform", "Opinion", "Political Affiliation", "Metric", "Device", "Age Group", "Social Network", "Club", "Media Type", "Question", "Statement", "University"
    - Descriptions must specify the scope (e.g., "European countries", "Technology industries")
    
    NUMERICAL COLUMNS:
    - Use names like "Revenue", "Score", "Rate", "Count", "Index", etc.
    - More examples: ""Units", "Score", "Percentage", "Ratio", "Value", "Dollars", "Points", "Market Share", "Count", "Sales", "Revenue", "Number of Deaths", "Price", "Exports", "Time Spent", "GDP Growth", "Temperature", "Cost", "Investment", "Consumer Price Index", "Earnings", "Attendance", "Population", "Subscribers", "Visitors", "Patients", "Production", "Donations", "Debt", "Shipments"
    - MUST include appropriate unit symbol in description:
      * Percentages: % (e.g., "Market share (%)")
      * Currency: $, £, €, GBP, USD (e.g., "Annual revenue ($m)")
      * Magnitude: k (thousands), m (millions), b (billions)
      * Measurements: km, kg, °C, etc.
    
    TEMPORAL COLUMNS:
    - Use names like "Year", "Quarter", "Month", "Period", etc.
    - Specify timeframe in description (e.g., "Fiscal year (2010-2020)")
    
    FORMAT:
    Return valid JSON in this structure:
    {{
        "selected_combination": "the_selected_combination",
        "columns": [
            {{
                "name": "Column1Name",
                "description": "Precise column description with units if applicable",
                "data_type": "categorical/numerical/temporal",
                "unit": "unit of the column" (if applicable, otherwise empty)
            }},
            ...more columns as needed for the combination...
        ]
    }}
    
    IMPORTANT: Your response must only contain the JSON structure above, DO NOT include any other text.
    """
    
    response = query_llm(prompt)
    if not response:
        return {"selected_combination": COLUMN_COMBINATIONS[0], "columns": []}
    
    result = parse_json_safely(response)
    try:
        # Validate the structure to ensure it has required keys
        if "selected_combination" not in result:
            result["selected_combination"] = COLUMN_COMBINATIONS[0]
        if "columns" not in result:
            result["columns"] = []
        # Add unit field if missing
        for col in result["columns"]:
            if "unit" not in col and col["data_type"] == "numerical":
                # Extract unit from description if possible
                desc = col["description"]
                if "%" in desc:
                    col["unit"] = "%"
                elif "$" in desc:
                    col["unit"] = "$"
                elif "£" in desc:
                    col["unit"] = "£"
                elif "€" in desc:
                    col["unit"] = "€"
                else:
                    col["unit"] = ""
            elif "unit" not in col:
                col["unit"] = ""
        return result
    except Exception as e:
        thread_safe_print(f"Error parsing column recommendation: {e}")
        print("response: ", result)
        # Return a default structure
        return {
            "selected_combination": COLUMN_COMBINATIONS[0],
            "columns": [
                {
                    "name": "Category",
                    "description": "Main category for the data",
                    "data_type": "categorical",
                    "unit": ""
                },
                {
                    "name": "Value",
                    "description": "Numerical value",
                    "data_type": "numerical",
                    "unit": ""
                }
            ]
        }

def generate_data(theme: Dict, scenario: str, selected_facts: List[Dict], column_recommendation: Dict, times = 1) -> List[Dict]:
    """生成数据"""
    results = []
    for _ in range(times):
        facts_str = "\n".join([f"- {fact['category']}: {fact['description']}" for fact in selected_facts])
        columns_str = "\n".join([f"- {col['name']} ({col['data_type']}): {col['description']}" for col in column_recommendation['columns']])
        
        # Determine data size constraints based on column combination using ranges
        combination = column_recommendation['selected_combination']
        constraints = []
        
        # Generate range constraints for different combinations
        if combination == "categorical + numerical" or combination == "categorical + numerical + numerical":
            constraints.append("First categorical column should have between 5-20 unique values")
        
        elif combination == "categorical + numerical + categorical" or combination == "categorical + numerical + numerical + categorical":
            constraints.append("First categorical column should have between 5-20 unique values")
            constraints.append("Second categorical column should have between 2-6 unique values")
            constraints.append("Total unique combinations should not exceed 60")
        
        elif combination == "temporal + numerical":
            constraints.append("Number of time points should be between 5-20")
        
        elif combination == "temporal + numerical + categorical":
            constraints.append("Number of time points should be between 5-20")
            constraints.append("Number of categories should be between 2-7")
        
        elif combination == "categorical + numerical + temporal":
            constraints.append("First categorical column should have between 5-20 unique values")
            constraints.append("Number of time points should be between 2-4")
        
        constraints_str = "\n".join([f"- {constraint}" for constraint in constraints])
        
        # 在提示中强调组合完整性和真实性
        prompt = f"""As a data generation expert, create HIGHLY REALISTIC data for this visualization:
        
        VISUALIZATION CONTEXT:
        - THEME: {theme['theme']}
        - SCENARIO: {scenario}
        - KEY DATA FACTS TO HIGHLIGHT:
        {facts_str}
        
        COLUMN STRUCTURE:
        {columns_str}
        
        DATA SIZE REQUIREMENTS:
        {constraints_str}
        
        COMBINATION REQUIREMENTS:
        - When both temporal and categorical columns exist, you MUST generate data for ALL possible combinations
        - For example, if you have Years=[2020,2021,2022] and Countries=[USA,China], generate data for all 6 combinations
        
        TEMPORAL DATA FORMAT REQUIREMENTS:
        - All temporal data MUST use YYYY, YYYY-MM, or YYYY-MM-DD format
        
        DATA CONTENT REQUIREMENTS:
        - Generate extremely realistic data that could pass for authentic published statistics
        - Ensure data exhibits the selected key facts while maintaining natural variability
        - ONLY generate data for the columns specified in COLUMN STRUCTURE above
        - DO NOT include any additional columns or attributes not listed in COLUMN STRUCTURE
        
        FORMAT:
        Return only valid JSON with this structure:
        {{
            "data": [
                {{
                    "column_name1": "value1",
                    "column_name2": value2,
                    ...
                }}
            ],
            "main_insight": "A clear statement of the primary insight revealed by this data",
            "titles": {{
                "main_title": "Concise and informative main title",
                "sub_title": "Optional subtitle that provides additional context"
            }}
        }}
        """
        
        response = query_llm(prompt)
        if not response:
            continue
        
        try:
            result = parse_json_safely(response)
            results.append(result)
        except Exception as e:
            thread_safe_print(f"Error parsing response: {e}")
            continue
    return results

def process_theme(theme: Dict, syn_data_dir: str) -> Dict:
    """处理单个主题、生成场景并保存数据"""
    thread_safe_print(f"Processing theme: '{theme['theme']}'")
    
    # 步骤1：生成场景
    scenarios = generate_scenarios_for_theme(theme)
    
    result = {
        'theme': theme['theme'],
        'base_description': theme['description'],
        'main_category': theme.get('main_category', ''),  # 添加main_category
        'scenarios': []
    }
    
    # 处理每个场景
    for i, scenario in enumerate(scenarios):
        scenario_num = i + 1
        thread_safe_print(f"  Scenario {scenario_num}/{len(scenarios)}: '{scenario[:50]}...'")
        
        selected_facts = select_relevant_datafacts(theme, scenario)
        for fact in selected_facts:
            try:
                column_recommendation = recommend_columns(theme, scenario, fact)
                
                # 如果没有有效的列结构，跳过
                if not column_recommendation or "columns" not in column_recommendation or not column_recommendation["columns"]:
                    thread_safe_print(f"    No valid column structure, skipping")
                    continue
                    
                # 步骤4：生成数据
                generated_datas = generate_data(theme, scenario, selected_facts, column_recommendation)
                
                # 如果没有数据，跳过
                for generated_data in generated_datas:
                    if not generated_data or "data" not in generated_data or not generated_data["data"]:
                        thread_safe_print(f"    No data generated, skipping")
                        continue
                    
                    # 准备场景结果
                    scenario_result = {
                        'description': scenario,
                        'data': {
                            'data': generated_data.get('data', []),
                            'columns': column_recommendation.get('columns', []),
                            'type_combination': column_recommendation.get('selected_combination', '')
                        },
                        'metadata': {
                            'main_insight': generated_data.get('main_insight', ''),
                            'datafact': selected_facts
                        },
                        'titles': generated_data.get('titles', {'main_title': '', 'sub_title': ''})
                    }
                    
                    save_individual_data(theme['theme'], scenario_result, scenario_num, syn_data_dir, theme.get('main_category', None))
                    
                thread_safe_print(f"    ✓ Completed")
            
            except Exception as e:
                thread_safe_print(f"    ✗ Error: {str(e)}")
                continue
    
    return result

def process_theme_wrapper(args):
    """Wrapper for process_theme to be used with ProcessPoolExecutor"""
    theme, syn_data_dir, theme_idx, total_themes = args
    thread_safe_print(f"\nProcessing theme {theme_idx+1}/{total_themes}: '{theme['theme']}'")
    try:
        theme_result = process_theme(theme, syn_data_dir)
        thread_safe_print(f"✓ Completed processing for theme {theme_idx+1}/{total_themes}: '{theme['theme']}'")
        return theme['theme'], theme_result
    except Exception as e:
        thread_safe_print(f"✗ Error processing theme '{theme['theme']}': {e}")
        import traceback
        thread_safe_print(f"Stack trace: {traceback.format_exc()}")
        return theme['theme'], {
            'theme': theme['theme'],
            'base_description': theme['description'],
            'main_category': theme.get('main_category', ''),  # 添加main_category
            'scenarios': []
        }

def save_results(results: Dict, output_file: str):
    """Save generated results to a JSON file"""
    with print_lock:  # Use lock to prevent file corruption from multiple threads
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

def save_individual_data(theme_name: str, scenario_data: Dict, index: int, syn_data_dir: str, main_category: str = None):
    """Save individual scenario data to separate JSON files in syn_data directory"""
    # Create safe filename from main_category (if available) or theme
    if main_category:
        prefix = "".join(c for c in main_category if c.isalnum() or c in [' ', '_']).strip().replace(' ', '_')
    else:
        prefix = "".join(c for c in theme_name if c.isalnum() or c in [' ', '_']).strip().replace(' ', '_')
    
    timestamp = datetime.now().strftime("%H%M%S")
    filename = f"{prefix}_scenario_{index}_{timestamp}_{random.randint(10000, 99999)}.json"
    filepath = os.path.join(syn_data_dir, filename)
    
    try:
        with print_lock:  # Use lock to prevent file corruption from multiple threads
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(scenario_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        thread_safe_print(f"Error saving individual data file {filepath}: {e}")
        return False

def main():
    # File paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    theme_file = os.path.join(current_dir, 'theme_new.json')
    output_file = os.path.join(current_dir, 'theme_analysis.json')
    
    thread_safe_print(f"Starting data generation process")
    thread_safe_print(f"Theme file: {theme_file}")
    thread_safe_print(f"Output file: {output_file}")
    
    # Create syn_data directory if it doesn't exist
    syn_data_dir = os.path.join(os.path.dirname(current_dir), 'syn_data')
    if not os.path.exists(syn_data_dir):
        os.makedirs(syn_data_dir)
        thread_safe_print(f"Created directory: {syn_data_dir}")
    
    # Load themes
    try:
        thread_safe_print(f"Loading themes from {theme_file}...")
        themes = load_themes(theme_file)
        thread_safe_print(f"Loaded {len(themes)} themes")
    except Exception as e:
        thread_safe_print(f"Error loading themes: {e}")
        return
    
    # Prepare for parallel processing
    results = {}
    NUM_WORKERS = 10  # Number of concurrent threads
    thread_safe_print(f"Using {NUM_WORKERS} concurrent workers for processing")
    
    # Create arguments for each theme processing task
    theme_args = [(theme, syn_data_dir, idx, len(themes)) for idx, theme in enumerate(themes)]
    
    # Process themes in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        # Submit all tasks and get futures
        future_to_theme = {executor.submit(process_theme_wrapper, args): args[0]['theme'] for args in theme_args}
        
        # Process results as they complete
        for future in tqdm(concurrent.futures.as_completed(future_to_theme), total=len(themes), desc="Processing themes"):
            theme_name = future_to_theme[future]
            try:
                theme_name, theme_result = future.result()
                results[theme_name] = theme_result
                
                # Save overall progress after each theme
                save_results(results, output_file)
                thread_safe_print(f"Updated overall progress file with theme '{theme_name}'")
                
            except Exception as e:
                thread_safe_print(f"Error processing theme '{theme_name}': {e}")
    
    thread_safe_print(f"\n========== SUMMARY ==========")
    thread_safe_print(f"Processed {len(results)} themes")
    total_scenarios = sum(len(theme_data['scenarios']) for theme_data in results.values())
    thread_safe_print(f"Generated {total_scenarios} scenarios in total")
    thread_safe_print(f"Full analysis saved to: {output_file}")
    thread_safe_print(f"Individual scenario data saved to: {syn_data_dir}")
    thread_safe_print(f"============================\n")

if __name__ == "__main__":
    main() 