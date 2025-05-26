from datetime import datetime
import cloudinary
import os

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
)

def generate_signature() -> dict:
    """
    Generate a signed Cloudinary upload url.
    """
    timestamp = datetime.now().timestamp()
    params_to_sign = {"timestamp": timestamp}
    signature = cloudinary.utils.api_sign_request(params_to_sign, cloudinary.config().api_secret)
    return {
        'signature': signature,
        'api_key': cloudinary.config().api_key,
        'timestamp': timestamp,
        'upload_url': f"https://api.cloudinary.com/v1_1/{cloudinary.config().cloud_name}/image/upload",
    }