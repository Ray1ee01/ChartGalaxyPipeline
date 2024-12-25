import subprocess
import json
import os

class NodeBridge:
    @staticmethod
    def execute_node_script(script_path: str, data: dict) -> str:
        # 将数据写入临时JSON文件
        tmp_input = 'temp_input.json'
        with open(tmp_input, 'w') as f:
            json.dump(data, f)
        # 执行Node.js脚本
        result = subprocess.run([
            'node', script_path, tmp_input
        ], capture_output=True, text=True)
        # 清理临时文件
        os.remove(tmp_input)
        
        print("return result.stdout", result.stdout)

        if result.returncode != 0:
            raise Exception(f"Node.js执行错误: {result.stderr}")

        return result.stdout
        