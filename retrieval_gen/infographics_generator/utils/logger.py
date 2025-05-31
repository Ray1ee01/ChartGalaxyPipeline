import os
import logging
from logging import getLogger

def setup_logger():
    """Configure and return the logger for infographics generator"""
    # 创建tmp目录（如果不存在）
    os.makedirs("tmp", exist_ok=True)

    # 配置日志
    logger = getLogger(__name__)
    logger.setLevel(logging.INFO)

    # 移除所有现有的处理器
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    # 创建文件处理器
    file_handler = logging.FileHandler('tmp/log.txt')
    file_handler.setLevel(logging.INFO)

    # 创建格式化器
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)

    # 添加处理器到logger
    logger.addHandler(file_handler)
    
    return logger 