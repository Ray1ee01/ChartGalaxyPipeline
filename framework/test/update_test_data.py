#!/usr/bin/env python3
import os
import sys
import logging
from update_data_format import process_directory

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("UpdateTestData")

def main():
    """
    Update all JSON files in the test/testset/data directory
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "testset", "data")
    
    if not os.path.exists(data_dir):
        logger.error(f"Test data directory not found: {data_dir}")
        return 1
    
    logger.info(f"Processing files in {data_dir}")
    process_directory(data_dir)
    logger.info("Test data update completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main()) 