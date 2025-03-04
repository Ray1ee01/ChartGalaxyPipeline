import subprocess
import json
import os
import random
class NodeBridge:
    @staticmethod
    def execute_node_script(script_path: str, data: dict) -> str:
        # 生成一个随机种子
        random.seed(random.randint(0, 1000000))
        # 将数据写入临时JSON文件
        tmp_input = f'temp_input_{random.randint(0, 1000000)}.json'
        
        with open(tmp_input, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        # 执行Node.js脚本
        result = subprocess.run([
            'node', script_path, tmp_input
        ], capture_output=True, encoding='utf-8')
        # 清理临时文件
        os.remove(tmp_input)
        

        if result.returncode != 0:
            raise Exception(f"Node.js执行错误: {result.stderr}")

        return result.stdout
        