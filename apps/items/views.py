# apps/items/views.py
from django.shortcuts import render, get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Item
from .serializers import ItemSerializer
from rest_framework import permissions
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.db.models import Q
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination

class ItemList(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        items = Item.objects.all()
        serializer = ItemSerializer(items, many=True)
        return Response(serializer.data)

class ItemCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Render template create_auction.html (hoặc tên template anh dùng)
        return render(request, 'items/create_item.html')

    def post(self, request):
        # Dữ liệu từ form giờ không còn file ảnh nữa
        print("Request data:", request.data)

        serializer = ItemSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            try:
                # Gán seller là người dùng hiện tại đang đăng nhập
                serializer.save(seller=request.user)

                context = {
                    'message': 'Tạo phiên đấu giá thành công (không có ảnh)!',
                }
                # Render lại trang với thông báo thành công
                return render(request, 'items/create_item.html', context)

                # Hoặc redirect, ví dụ:
                # from django.urls import reverse
                # return redirect(reverse('item_detail_url_name', args=[serializer.instance.item_id]))

            except Exception as e:
                print(f"Error during save: {e}")
                context = {
                    'errors': {'non_field_errors': [f'Có lỗi xảy ra trong quá trình lưu: {e}']},
                    'form_data': request.data
                }
                return render(request, 'items/create_item.html', context, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Nếu serializer không hợp lệ, hiển thị lỗi
            print("Serializer errors:", serializer.errors) # Rất quan trọng để debug
            context = {
                'errors': serializer.errors,
                'form_data': request.data
            }
            return render(request, 'items/create_item.html', context, status=status.HTTP_400_BAD_REQUEST)

class ItemDetail(APIView):
    def get_object(self, pk):
        try:
            return Item.objects.get(pk=pk)
        except Item.DoesNotExist:
            return None

    def get(self, request, pk):
        item = self.get_object(pk)
        if item:
            serializer = ItemSerializer(item)
            return Response(serializer.data)
        return Response(status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        item = self.get_object(pk)
        if item:
            serializer = ItemSerializer(item, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        item = self.get_object(pk)
        if item:
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)

# View cho trang chi tiết sản phẩm (item_details)
def item_detail_view(request, pk):
    item = get_object_or_404(Item, pk=pk)
    # Tính toán phần trăm giảm giá
    if item.starting_price and item.current_price and item.starting_price > 0:
        discount = ((item.starting_price - item.current_price) / item.starting_price) * 100
        discount = round(discount)  # Thực hiện làm tròn
    else:
        discount = 0
    return render(request, 'items/item_detail.html', {'item': item, 'discount': discount})

class ItemListPagination(PageNumberPagination):
    page_size = 10  # Số item mỗi trang
    page_size_query_param = 'page_size' # Cho phép client override page_size qua query param
    max_page_size = 100 # Giới hạn page_size tối đa

"""class ItemSearchAPI(APIView):
    permission_classes = [permissions.AllowAny]
    pagination_class = ItemListPagination

    def get(self, request):
        try:
            print(f"Total items in database: {Item.objects.count()}")
            query_text = request.query_params.get('q', '').strip()
            category = request.query_params.get('category', '')
            sort = request.query_params.get('sort', 'relevance') # Default sort by relevance
            
            print(f"Search API - query: '{query_text}', category: '{category}', sort: '{sort}'")
            
            # Base queryset - start with all items
            queryset = Item.objects.all()

            if query_text:
                # Fallback to simple SQL LIKE search - more reliable than full-text search
                queryset = queryset.filter(
                    Q(name__icontains=query_text) | 
                    Q(description__icontains=query_text)
                )
                
                # Try to use simple full-text search if available, but don't rely on it completely
                try:
                    # Simple text configuration
                    config = 'simple'
                    search_vector = (
                        SearchVector('name', weight='A', config=config) +
                        SearchVector('description', weight='B', config=config)
                    )
                    search_query = SearchQuery(query_text, config=config)
                    
                    # Annotate with rank for sorting by relevance
                    queryset = queryset.annotate(
                        rank=SearchRank(search_vector, search_query)
                    )
                    
                    # Only sort by rank if requested
                    if sort == 'relevance':
                        queryset = queryset.order_by('-rank')
                except Exception as e:
                    print(f"Full-text search failed, using basic search only: {e}")
                    # If full-text search fails, still have results from LIKE query
            
            # Apply category filter if provided
            if category:
                queryset = queryset.filter(category=category)
            
            # Apply sorting - with fallbacks if needed
            if sort == 'ending-soon':
                queryset = queryset.filter(end_time__gt=timezone.now()).order_by('end_time')
            elif sort == 'price-low':
                queryset = queryset.order_by('current_price')
            elif sort == 'price-high':
                queryset = queryset.order_by('-current_price')
            elif sort == 'newest' or (sort == 'relevance' and not query_text):
                queryset = queryset.order_by('-item_id')  # Default sort

            print(f"Search API queryset count: {queryset.count()}")
            
            # Apply pagination
            paginator = self.pagination_class()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 
            page = paginator.paginate_queryset(queryset, request)
            
            if page is not None:
                serializer = ItemSerializer(page, many=True, context={'request': request})
                return paginator.get_paginated_response(serializer.data)
            
            serializer = ItemSerializer(queryset, many=True, context={'request': request})
            return Response(serializer.data)

        except Exception as e:
            import traceback
            print(f"Error in ItemSearchAPI: {type(e).__name__} - {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": "An unexpected error occurred during search.", "details": f"{type(e).__name__}: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )"""


class ItemSearchAPI(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query_text = request.query_params.get('q', '').strip()
        results = Item.objects.none()
        
        VIETNAMESE_FTS_CONFIG = 'public.vietnamese_fts' # Hoặc tên config của bạn

        if query_text:
            # 1. Định nghĩa SearchVector (giống như trước)
            search_vector_expression = ( # Đổi tên biến để tránh nhầm lẫn với trường annotate
                SearchVector('name', weight='A', config=VIETNAMESE_FTS_CONFIG) +
                SearchVector('description', weight='B', config=VIETNAMESE_FTS_CONFIG)
            )

            # 2. Tạo SearchQuery (giống như trước)
            search_query_object = SearchQuery(query_text, search_type='websearch', config=VIETNAMESE_FTS_CONFIG) # Đổi tên biến

            # 3. Thực hiện tìm kiếm, annotate, filter và order
            results = (
                Item.objects.annotate(
                    # Annotate cả search_vector và rank
                    search=search_vector_expression, # Tạo trường 'search' chứa tsvector
                    rank=SearchRank(search_vector_expression, search_query_object) # Dùng lại search_vector_expression
                )
                # Filter trên trường 'search' đã được annotate
                .filter(search=search_query_object, rank__gte=0.01) 
                .order_by('-rank')
            )
            
        serializer = ItemSerializer(results, many=True, context={'request': request})
        return Response(serializer.data)
    
    
def item_search_view(request):
    query_text = request.GET.get('q', '').strip()
    context = {
        'query_from_url': query_text,
    }
    return render(request, 'items/search_results.html', context)

class ItemListAPI(APIView):
    permission_classes = [permissions.AllowAny]
    pagination_class = ItemListPagination

    def get(self, request):
        try:
            # Debug: Check total items
            print(f"Total items in database: {Item.objects.count()}")
             
            # Get query parameters
            search = request.query_params.get('search', '')
            sort = request.query_params.get('sort', 'newest')
            
            print(f"Items API - search: '{search}', sort: '{sort}'")
            
            # Base queryset
            queryset = Item.objects.all()
            
            # Apply search filter if provided - use reliable LIKE query
            if search:
                queryset = queryset.filter(
                    Q(name__icontains=search) | 
                    Q(description__icontains=search)
                )
                
                # Try to use simple full-text search for ranking only if needed
                # This is optional and won't affect the actual results, just the order
                if sort == 'relevance':
                    try:
                        config = 'simple'
                        search_vector = (
                            SearchVector('name', weight='A', config=config) +
                            SearchVector('description', weight='B', config=config)
                        )
                        search_query = SearchQuery(search, config=config)
                        
                        queryset = queryset.annotate(
                            rank=SearchRank(search_vector, search_query)
                        ).order_by('-rank')
                    except Exception as e:
                        print(f"Full-text ranking failed, using default sort: {e}")
                        queryset = queryset.order_by('-item_id')  # Default fallback sort
            
            # Apply sorting (only if not already sorted by relevance)
            if not (search and sort == 'relevance'):
                if sort == 'ending-soon':
                    queryset = queryset.filter(end_time__gt=timezone.now()).order_by('end_time')
                elif sort == 'price-low':
                    queryset = queryset.order_by('current_price')
                elif sort == 'price-high':
                    queryset = queryset.order_by('-current_price')
                else:  # newest is default
                    queryset = queryset.order_by('-item_id')
            
            print(f"Items API queryset count: {queryset.count()}")
            
            # Apply pagination
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(queryset, request)
            
            if page is not None:
                serializer = ItemSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)
            
            serializer = ItemSerializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"Error in ItemListAPI: {type(e).__name__} - {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": "An unexpected error occurred while fetching items.", "details": f"{type(e).__name__}: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
            
def item_list_view(request):
    return render(request, 'items/item_list.html')