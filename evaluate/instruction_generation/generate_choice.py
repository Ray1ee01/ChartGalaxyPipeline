import random
import math
from decimal import Decimal, getcontext, ROUND_HALF_UP, InvalidOperation

# getcontext().prec = 28 # Default precision is usually sufficient

def _get_number_properties(value):
    """Analyzes a number to determine its properties."""
    try:
        d_value = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("Input 'correct_answer' must be a valid number string or number.")
    except Exception as e:
        # Catch other potential errors during Decimal conversion
        raise ValueError(f"Input 'correct_answer' ({value}) could not be converted to Decimal: {e}")


    if not d_value.is_finite():
        raise ValueError("Input 'correct_answer' must be a finite number.")

    is_negative = d_value.is_signed() # More reliable way to check sign
    
    exponent = d_value.as_tuple().exponent
    precision = 0
    if isinstance(exponent, int) and exponent < 0:
        precision = abs(exponent)
        is_integer = False
    else:
        # Handle cases like Decimal('1E+3') which are integers
        is_integer = exponent >= 0 or d_value == d_value.to_integral_value()

    magnitude_level = Decimal(1)
    if is_integer and d_value != 0:
        # Determine magnitude level based on trailing zeros for integers
        s_val = str(d_value.to_integral_value(rounding=ROUND_HALF_UP))
        if '.' in s_val: s_val = s_val.split('.')[0] # Should not happen with to_integral_value but safe check

        trailing_zeros = 0
        for char in reversed(s_val):
            if char == '0':
                trailing_zeros += 1
            else:
                break
        # Only assign if there are actual trailing zeros significant to the number's value
        if trailing_zeros > 0 and d_value % (Decimal(10) ** trailing_zeros) == 0:
            magnitude_level = Decimal(10) ** trailing_zeros


    return {
        "decimal_value": d_value,
        "precision": precision,
        "is_integer": is_integer,
        "is_negative": is_negative,
        "magnitude_level": magnitude_level, # Add magnitude level
        "original_string": str(value) # Keep original string for reference if needed
    }

def _format_number(value, precision, prefix="", suffix=""):
    """Formats the number according to the determined precision and affixes."""
    try:
        d_value = Decimal(str(value))
        # Use quantize for rounding to the target precision before formatting
        # This handles cases where calculations might introduce extra insignificant digits
        quantized_value = d_value.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)
        
        # Convert to string with proper formatting 
        if precision == 0:
            # For integers, just use simple conversion
            formatted_num_str = str(quantized_value).split('.')[0]
        else:
            # For decimals, format with exact precision then remove trailing zeros if needed
            formatted_num_str = format(quantized_value, f'.{precision}f')
            # Remove trailing zeros only if there's a decimal point
            if '.' in formatted_num_str and precision > 0:
                # Remove trailing zeros but keep at least one decimal place if non-integer
                while formatted_num_str.endswith('0') and formatted_num_str.count('0', formatted_num_str.index('.')) > 1:
                    formatted_num_str = formatted_num_str[:-1]
                # If we ended up with just '.0', it's actually an integer
                if formatted_num_str.endswith('.0'):
                    formatted_num_str = formatted_num_str[:-2]
        
        # Handle potential negative zero after quantization/formatting
        if formatted_num_str == f'-{0:.{precision}f}':
             formatted_num_str = f'{0:.{precision}f}'
             
        return f"{prefix}{formatted_num_str}{suffix}"
    except Exception:
        # Fallback or error handling if formatting fails
        return f"{prefix}{value}{suffix}"

# --- Distractor Generation Strategies (Minor adjustments possible) ---

def _add_small_offset(d_value, precision, magnitude_level=Decimal(1)):
    """Adds or subtracts a small value, respecting integer magnitude."""
    if precision == 0 and magnitude_level > 1:
        # Offset scaled by magnitude level for integers with trailing zeros
        offset = magnitude_level * Decimal(random.choice([-3, -2, -1, 1, 2, 3]))
    elif precision == 0:
        # Slightly larger range for integers without significant trailing zeros
        offset = Decimal(random.choice([-3, -2, -1, 1, 2, 3]))
    else: # Decimal logic
        smallest_unit = Decimal('1') / (Decimal('10') ** precision)
        # Slightly larger range for decimals
        offset = random.choice([-3, -2, -1, 1, 2, 3]) * smallest_unit
    
    result = d_value + offset
    
    # Avoid returning 0 if original wasn't 0, unless offset naturally makes it 0
    # Refined check for magnitude_level might be complex, keep simple avoidance for now
    if result == 0 and d_value != 0: # Check if result becomes 0
         # Try a different offset direction, respecting magnitude if applicable
         new_choice = [1, 2, 3] if offset < 0 else [-1, -2, -3]
         if precision == 0 and magnitude_level > 1:
             offset = magnitude_level * Decimal(random.choice(new_choice))
         elif precision == 0:
             offset = Decimal(random.choice(new_choice))
         else:
             smallest_unit = Decimal('1') / (Decimal('10') ** precision)
             offset = (Decimal(random.choice(new_choice)) * smallest_unit)
         result = d_value + offset # Recalculate result with new offset
    
    # Quantize the result to the same precision as the input
    return result.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)


def _nearby_value(d_value, precision, magnitude_level=Decimal(1)):
    """Generates a value numerically close but potentially further, respecting integer magnitude."""
    if precision == 0 and magnitude_level > 1:
         # Wider range scaled by magnitude level
         offset = magnitude_level * Decimal(random.choice([-10, -7, -5, -4, 4, 5, 7, 10]))
         result = d_value + offset
         # For large scaled offsets, becoming zero is less problematic, so we don't explicitly avoid it here
         # Quantize the result
         return result.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)
    elif precision == 0:
         # Wider range for regular integers
         offset = Decimal(random.choice([-10, -7, -5, -4, 4, 5, 7, 10]))
         result = d_value + offset
         # Avoid zero only if original is non-zero for smaller integers
         result = result if result != 0 or d_value == 0 else d_value + Decimal(random.choice([4,5,7,10]))
         # Quantize the result
         return result.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)
    else:
        # Wider range for decimals, relative to magnitude
        magnitude_factor = Decimal('10') ** (precision) # Use precision directly
        # Generate offset relative to the smallest unit, but with larger multipliers
        offset_scale = Decimal(random.choice([-10, -7, -5, -3, -2, 2, 3, 5, 7, 10]))
        offset = offset_scale / magnitude_factor
        result = d_value + offset
        # Quantize the result
        return result.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)

def _incorrect_rounding(d_value, precision):
    """Simulates rounding incorrectly or rounding to a different precision."""
    # Ensure the core logic remains, maybe add more rounding modes
    rounding_modes = [ROUND_HALF_UP, 'ROUND_DOWN', 'ROUND_UP', 'ROUND_HALF_EVEN', 'ROUND_HALF_DOWN']
    
    options = []
    # Option 1: Round to one less decimal place
    if precision > 0:
        try:
            rounded_less = d_value.quantize(Decimal('1e-' + str(precision - 1)), rounding=random.choice(rounding_modes))
            if rounded_less != d_value: options.append(rounded_less)
        except Exception: pass

    # Option 2: Round to one more decimal place
    try:
        noise = Decimal(random.uniform(-0.1, 0.1)) / (Decimal('10')**precision)
        rounded_more = (d_value + noise).quantize(Decimal('1e-' + str(precision + 1)), rounding=random.choice(rounding_modes))
        if rounded_more != d_value: options.append(rounded_more)
    except Exception: pass

    # Option 3: Add noise then round to original precision
    try:
        noise = Decimal(random.uniform(-0.5, 0.5)) / (Decimal('10')**(precision))
        result = (d_value + noise).quantize(Decimal('1e-' + str(precision)), rounding=random.choice(rounding_modes))
        if result != d_value: options.append(result)
    except Exception: pass

    if options:
        return random.choice(options)
    else:
        # Fallback if no rounding option worked or changed the value
        fallback_offset = (Decimal('1') / (Decimal('10')**precision)) * Decimal(random.choice([-1, 1]))
        # Quantize the fallback result
        return (d_value + fallback_offset).quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)


def _swap_adjacent_digits(d_value, precision):
    """Swaps two adjacent digits in the string representation."""
    # Keep original logic, maybe try swapping non-adjacent digits too? (more complex)
    # For now, keep as is, it provides a different kind of error.
    s_value = format(d_value, f'.{precision}f')
    sign = ""
    if d_value.is_signed() and not d_value.is_zero(): # Check sign correctly
        sign = "-"
        s_value = s_value[1:]

    if '.' in s_value:
        parts = s_value.split('.')
        integer_part = parts[0]
        fractional_part = parts[1]
    else:
        integer_part = s_value
        fractional_part = ""
        
    # Handle cases like '.5' -> '0.5' formatting
    if not integer_part and fractional_part:
        integer_part = "0"

    eligible_chars = list(integer_part + fractional_part)
    if len(eligible_chars) < 2:
        return d_value # Not enough digits to swap

    for _ in range(10): # More attempts to find a valid swap
        idx = random.randint(0, len(eligible_chars) - 2)

        # Basic check: don't swap identical digits
        if eligible_chars[idx] == eligible_chars[idx+1]:
            continue

        # Avoid creating leading zero in integer part unless original was like "0.xx" or "0"
        is_int_part_swap = (idx < len(integer_part) and (idx + 1) < len(integer_part))
        if idx == 0 and eligible_chars[idx+1] == '0' and len(integer_part) > 1 and integer_part != "0":
             continue

        # Perform swap
        eligible_chars[idx], eligible_chars[idx+1] = eligible_chars[idx+1], eligible_chars[idx]

        # Reconstruct
        new_integer_part = "".join(eligible_chars[:len(integer_part)])
        new_fractional_part = "".join(eligible_chars[len(integer_part):])

        # Handle reconstruction edge cases (e.g., integer part becomes empty)
        if not new_integer_part: new_integer_part = "0" # Should not happen with current logic but safe check

        new_s_value = new_integer_part
        if new_fractional_part or precision > 0: # Ensure decimal point if precision > 0
            new_s_value += "." + new_fractional_part

        try:
            new_d_value = Decimal(sign + new_s_value)
            # Ensure the swap actually changed the value numerically after potential re-formatting
            if new_d_value.quantize(Decimal('1e-' + str(precision))) != d_value.quantize(Decimal('1e-' + str(precision))):
                # Quantize the successful result before returning
                return new_d_value.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)
            else: # Swap back if no change occurred
                 eligible_chars[idx], eligible_chars[idx+1] = eligible_chars[idx+1], eligible_chars[idx]
        except Exception: # Swap back if conversion fails
             eligible_chars[idx], eligible_chars[idx+1] = eligible_chars[idx+1], eligible_chars[idx]
             continue

    return d_value # Return original if no valid swap found


def _digit_manipulation(d_value, precision):
    """Changes a single random digit."""
    # Keep original logic, maybe ensure the changed digit isn't the same as original.
    s_value = format(d_value, f'.{precision}f')
    sign = ""
    if d_value.is_signed() and not d_value.is_zero():
        sign = "-"
        s_value = s_value[1:]

    # Find indices of digits
    digit_indices = [i for i, char in enumerate(s_value) if char.isdigit()]
    if not digit_indices:
        return d_value # No digits to change

    for _ in range(10): # More attempts
        idx_to_change_in_s = random.choice(digit_indices)
        original_digit = s_value[idx_to_change_in_s]

        # Choose a *different* digit
        possible_new_digits = [d for d in '0123456789' if d != original_digit]
        if not possible_new_digits: continue # Should only happen if original is all same digits?
        new_digit = random.choice(possible_new_digits)

        # Avoid creating leading zero in integer part (unless it's the only digit before '.' or original is '0.xx')
        is_leading_integer_digit = ('.' not in s_value[:idx_to_change_in_s] and
                                    idx_to_change_in_s == 0 and
                                    len(s_value.split('.')[0]) > 1 and
                                    not s_value.startswith('0.')) # Allow changing 0 in '0.xx'

        if is_leading_integer_digit and new_digit == '0':
            continue # Skip if trying to make a leading zero inappropriately

        # Create new string
        s_list = list(s_value)
        s_list[idx_to_change_in_s] = new_digit
        new_s_value = "".join(s_list)

        try:
            new_d_value = Decimal(sign + new_s_value)
            # Ensure change occurred numerically
            if new_d_value.quantize(Decimal('1e-' + str(precision))) != d_value.quantize(Decimal('1e-' + str(precision))):
                # Quantize the successful result before returning
                return new_d_value.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)
        except Exception:
            continue # Try again if conversion fails

    return d_value # Return original if manipulation failed

# --- Main Function ---

def generate_numerical_distractors(correct_answer, num_distractors=4, prefix="", suffix="",
                                   force_integer=False, force_non_negative=False, fixed_precision=None):
    """
    Generates plausible numerical distractors using oversampling and selection.

    Args:
        correct_answer (int | float | str): The correct numerical answer.
        num_distractors (int): The number of distractors to generate. Default is 3.
        prefix (str): A string to prepend to each option (e.g., '$'). Default is "".
        suffix (str): A string to append to each option (e.g., '%'). Default is "".
        force_integer (bool): If True, ensures all generated distractors are integers.
                              Defaults to False.
        force_non_negative (bool): If True, ensures all generated distractors are non-negative (>= 0).
                                   Defaults to False.
        fixed_precision (int, optional): If provided, uses this exact precision for all distractors
                                 instead of inferring from the correct answer. Defaults to None.

    Returns:
        list[str]: A list of unique, formatted distractor strings, selected for diversity.
                   Returns an empty list if generation fails or inputs are invalid.
    """
    if not isinstance(num_distractors, int) or num_distractors <= 0:
        print("Warning: num_distractors must be a positive integer.")
        return []

    try:
        props = _get_number_properties(correct_answer)
        correct_d_value = props["decimal_value"]
        # Use fixed_precision if provided, otherwise use inferred precision
        precision = fixed_precision if fixed_precision is not None else props["precision"]
        # Force precision to 0 if force_integer is True
        if force_integer:
            precision = 0
        magnitude_level = props.get("magnitude_level", Decimal(1)) # Get magnitude level
    except ValueError as e:
        print(f"Error processing correct_answer: {e}")
        return []
    except Exception as e: # Catch unexpected errors
        print(f"Unexpected error processing correct_answer '{correct_answer}': {e}")
        return []


    # List of available strategies
    strategies = [
        _add_small_offset,
        _nearby_value,
        _incorrect_rounding, # May produce non-integers, checked later
        _digit_manipulation, # May produce non-integers, checked later
    ]


    # --- Generation Phase (Oversampling) ---
    candidate_pool = {} # Use dict to store {quantized_value: (original_decimal, formatted_string, distance)}
    num_candidates_to_generate = max(num_distractors * 3, 10) # Generate more candidates
    max_attempts_total = num_candidates_to_generate * 5 # Limit overall attempts

    attempts_total = 0
    while len(candidate_pool) < num_candidates_to_generate and attempts_total < max_attempts_total:
        attempts_total += 1
        if not strategies: # Handle case where no strategies are applicable
            print("Warning: No applicable generation strategies found for the given constraints.")
            break
        strategy = random.choice(strategies)

        try:
            # Apply strategy
            if strategy in [_add_small_offset, _nearby_value]:
                 potential_distractor_dec = strategy(correct_d_value, precision, magnitude_level) # Pass magnitude_level
            elif strategy in [_incorrect_rounding, _digit_manipulation]:
                 # These strategies primarily depend on precision or string format
                 potential_distractor_dec = strategy(correct_d_value, precision)
            else: # Strategies only needing the value
                 potential_distractor_dec = strategy(correct_d_value)

            # --- Validation ---
            if not potential_distractor_dec.is_finite():
                continue

            # Quantize for uniqueness check, comparison, and constraint validation
            # Use ROUND_HALF_UP consistently
            quantized_potential = potential_distractor_dec.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)
            quantized_correct = correct_d_value.quantize(Decimal('1e-' + str(precision)), rounding=ROUND_HALF_UP)

            # --- Apply Constraints ---
            if force_integer:
                 # Check if the quantized value represents an integer (exponent >= 0)
                 # Use a tolerance check as quantization might leave tiny residual fractions for intended integers
                 # Check if it's practically an integer
                 if quantized_potential != quantized_potential.to_integral_value(rounding=ROUND_HALF_UP):
                     continue # Skip non-integer

            if force_non_negative:
                 # Check sign of the quantized value, allowing zero
                 if quantized_potential < 0:
                     continue # Skip negative


            # Different from correct answer?
            if quantized_potential == quantized_correct:
                continue

            # Already in pool? (Check quantized value)
            if quantized_potential in candidate_pool:
                continue

            # --- If valid, add to pool ---
            formatted_string = _format_number(quantized_potential, precision, prefix, suffix)
            distance = abs(potential_distractor_dec - correct_d_value)
            
            # Store using quantized value as key for uniqueness
            candidate_pool[quantized_potential] = (potential_distractor_dec, formatted_string, distance)

        except Exception as e:
            # print(f"Debug: Strategy {strategy.__name__} failed with error: {e}") # Optional
            continue # Try next strategy if one fails

    # --- Selection Phase ---
    if len(candidate_pool) < num_distractors:
        print(f"Warning: Generated only {len(candidate_pool)} unique candidates, less than the requested {num_distractors}. Returning all generated.")
        # Fallback: return whatever was generated if not enough candidates
        selected = [data[1] for data in candidate_pool.values()]
        # Final cleanup of any remaining precision issues
        return selected

    # Convert pool values to a list and sort by distance
    candidates_list = sorted(list(candidate_pool.values()), key=lambda item: item[2]) # Sort by distance

    selected_distractors = []
    
    # Selection strategy: Aim for spread
    # Pick the closest, the furthest, and sample from intermediate points
    
    if num_distractors == 1:
        selected_distractors.append(candidates_list[0][1]) # Pick the closest
    elif num_distractors == 2:
        selected_distractors.append(candidates_list[0][1]) # Closest
        selected_distractors.append(candidates_list[-1][1]) # Furthest
    elif num_distractors >= 3:
        selected_distractors.append(candidates_list[0][1]) # Closest
        selected_distractors.append(candidates_list[-1][1]) # Furthest
        
        # Select remaining from the middle range, trying to space them out
        remaining_needed = num_distractors - 2
        middle_candidates = candidates_list[1:-1]
        
        if len(middle_candidates) <= remaining_needed:
            # If not enough middle candidates, just add them all
             selected_distractors.extend([c[1] for c in middle_candidates])
        else:
            # Sample from middle candidates using indices spread out
            step = len(middle_candidates) / (remaining_needed + 1)
            for i in range(remaining_needed):
                idx = int((i + 1) * step) 
                # Ensure index is within bounds
                idx = min(idx, len(middle_candidates) -1) 
                selected_distractors.append(middle_candidates[idx][1])
                # Optional: remove selected to avoid duplicates if step size is small (though uniqueness is already handled by pool)

    # Ensure final list has exactly num_distractors if possible, shuffling might be good too
    final_distractors = list(dict.fromkeys(selected_distractors)) # Ensure uniqueness again (should be redundant)
    
    # If somehow we have too few (e.g., constraints removed many, or closest/furthest were same after formatting), fill from remaining candidates
    fill_needed = num_distractors - len(final_distractors)
    if fill_needed > 0:
        remaining_candidates_formatted = [c[1] for c in candidates_list if c[1] not in final_distractors]
        final_distractors.extend(remaining_candidates_formatted[:fill_needed])

    # Final shuffle of the selected distractors so closest/furthest aren't always first/last
    random.shuffle(final_distractors)

    # Final check on count
    if len(final_distractors) != num_distractors:
         print(f"Warning: Final selection resulted in {len(final_distractors)} distractors instead of {num_distractors}.")

    # Return exactly the number requested
    return final_distractors[:num_distractors]


if __name__ == "__main__":
# --- Example Usage ---
    correct_answers = [123, 45.67, 0.5, 1000, -25.5, 0, 99.99, 1.0, 50, 0.01, 11000, -2500, 10] # Added large integer cases
    num_options = 4 # Generate 4 distractors

    for answer in correct_answers:
        print(f"--- Correct Answer: {answer} ---")

        # Generate with improved selection
        distractors = generate_numerical_distractors(answer, num_options)
        print(f"Generated Distractors ({num_options}): {distractors}")

        # Example with currency prefix
        distractors_usd = generate_numerical_distractors(answer, num_options, prefix="$")
        print(f"Generated Distractors (USD): {distractors_usd}")

        # Example with integer constraint
        distractors_int = generate_numerical_distractors(answer, num_options, force_integer=True)
        print(f"Generated Distractors (Integer only): {distractors_int}")

        # Example with non-negative constraint
        distractors_nonneg = generate_numerical_distractors(answer, num_options, force_non_negative=True)
        print(f"Generated Distractors (Non-negative only): {distractors_nonneg}")

        # Example with both constraints
        distractors_int_nonneg = generate_numerical_distractors(answer, num_options, force_integer=True, force_non_negative=True)
        print(f"Generated Distractors (Int & Non-negative): {distractors_int_nonneg}")

        # Example with fixed precision (2 decimal places)
        distractors_fixed_prec = generate_numerical_distractors(answer, num_options, fixed_precision=2)
        print(f"Generated Distractors (Fixed 2 decimal places): {distractors_fixed_prec}")

        print("-" * 30)

    # Example with potential failure
    print("--- Example with potential failure (requesting many distractors for 0) ---")
    distractors_zero = generate_numerical_distractors(0, 10) # Requesting 10 for 0
    print(f"Generated Distractors for 0: {distractors_zero}")
    print("-" * 30)