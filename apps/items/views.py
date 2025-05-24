# apps/items/views.py
from django.shortcuts import render, get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Item
from .serializers import ItemSerializer
from rest_framework import permissions
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.db.models import Q, Count, F, ExpressionWrapper, Case, FloatField, Value, When
from django.db.models.functions import Now
from django.db.models.functions import Extract
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
    permission_classes = [permissions.AllowAny]
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
    page_size = 20  # Số item mỗi trang
    page_size_query_param = 'page_size' # Cho phép client override page_size qua query param
    max_page_size = 100 # Giới hạn page_size tối đa

class ItemSearchAPI(APIView):
    permission_classes = [permissions.AllowAny]
    pagination_class = ItemListPagination

    def get(self, request):
        try:
            query_text = request.query_params.get('q', '').strip()
            category_id = request.query_params.get('category', '') # Giả sử category là ID
            sort_option = request.query_params.get('sort', 'relevance' if query_text else 'newest') # Default to newest if no query

            print(f"Search API - query: '{query_text}', category_id: '{category_id}', sort: '{sort_option}'")

            queryset = Item.objects.all()
            
            # Annotate số lượt bid sớm để có thể dùng trong các sắp xếp
            # Đảm bảo 'bids' là related_name từ Bid -> Item, hoặc dùng 'bid_set'
            queryset = queryset.annotate(num_bids=Count('bids')) 

            # 1. Apply Filters
            if query_text:
                queryset = queryset.filter(
                    Q(name__icontains=query_text) |
                    Q(description__icontains=query_text)
                )

            if category_id:
                try:
                    # Chuyển đổi category_id sang integer nếu nó là số
                    # Hoặc nếu category là slug (chuỗi), thì filter theo slug
                    queryset = queryset.filter(category_id=int(category_id))
                except ValueError:
                    print(f"Warning: Invalid category_id '{category_id}'. Ignoring category filter.")
                # Nếu category là một trường CharField (ví dụ: slug)
                # queryset = queryset.filter(category__slug=category_id)


            # 2. Apply Sorting
            is_relevance_search = query_text and sort_option == 'relevance'

            if is_relevance_search:
                try:
                    config = 'Vietnamese_fts' # Hoặc 'Vietnamese_fts' nếu đã cấu hình đúng
                    search_vector = (
                        SearchVector('name', weight='A', config=config) +
                        SearchVector('description', weight='B', config=config)
                    )
                    search_query = SearchQuery(query_text, config=config, search_type='websearch') # Thêm search_type
                    
                    queryset = queryset.annotate(
                        rank=SearchRank(search_vector, search_query)
                    ).order_by('-rank', '-num_bids', '-item_id') # Thêm tiêu chí phụ
                    print("Applied relevance sort")
                except Exception as e:
                    print(f"Full-text search for relevance failed: {e}. Falling back to newest.")
                    queryset = queryset.order_by('-item_id', '-num_bids') # Fallback
            else:
                if sort_option == 'ending-soon':
                    queryset = queryset.filter(end_time__gt=timezone.now()).order_by('end_time', '-num_bids')
                elif sort_option == 'price-low':
                    queryset = queryset.order_by('current_price', '-num_bids')
                elif sort_option == 'price-high':
                    queryset = queryset.order_by('-current_price', '-num_bids')
                elif sort_option == 'most-bids': # Đảm bảo frontend gửi 'most-bids'
                    queryset = queryset.order_by('-num_bids', '-created_at')
                elif sort_option == 'hottest':
                    db_now = Now()
                    age_in_seconds_expr = ExpressionWrapper(
                        Extract(db_now - F('created_at'), 'epoch'), # Cho PostgreSQL
                        output_field=FloatField()
                    )
                    # Nếu dùng SQLite:
                    # age_in_seconds_expr = ExpressionWrapper(
                    #    (Func(db_now, function='JULIANDAY') - Func(F('created_at'), function='JULIANDAY')) * Value(86400.0),
                    #    output_field=FloatField()
                    # )
                    # Nếu dùng MySQL:
                    # age_in_seconds_expr = Func(Value('SECOND'), F('created_at'), db_now, function='TIMESTAMPDIFF', output_field=FloatField())

                    queryset = queryset.annotate(age_in_seconds_val=age_in_seconds_expr)
                    
                    MIN_HOURS_FOR_RATE = 1.0 # Dùng float
                    SECONDS_IN_HOUR = 3600.0

                    effective_hours_expr = Case(
                        When(Q(age_in_seconds_val__lt=MIN_HOURS_FOR_RATE * SECONDS_IN_HOUR) & Q(age_in_seconds_val__gt=0),
                             then=Value(MIN_HOURS_FOR_RATE)),
                        When(Q(age_in_seconds_val__gte=MIN_HOURS_FOR_RATE * SECONDS_IN_HOUR),
                             then=ExpressionWrapper(F('age_in_seconds_val') / SECONDS_IN_HOUR, output_field=FloatField())),
                        default=Value(MIN_HOURS_FOR_RATE), # Fallback
                        output_field=FloatField()
                    )
                    
                    hotness_score_expr = ExpressionWrapper(
                        (F('num_bids') + Value(0.001)) / effective_hours_expr, # Thêm giá trị nhỏ để tránh chia cho 0 nếu num_bids = 0 và effective_hours cũng = 0 (mặc dù default của effective_hours là MIN_HOURS_FOR_RATE)
                        output_field=FloatField()
                    )
                    queryset = queryset.annotate(
                        hotness_score=hotness_score_expr
                    ).order_by('-hotness_score', '-num_bids', '-created_at')
                elif sort_option == 'newest':
                    queryset = queryset.order_by('-created_at', '-num_bids') # Ưu tiên created_at
                else: # Default (nếu sort_option không hợp lệ hoặc là relevance mà không có query_text)
                    print(f"Defaulting sort to newest for sort_option: {sort_option}")
                    queryset = queryset.order_by('-created_at', '-num_bids')

            print(f"Search API queryset count after sort: {queryset.count()}")

            paginator = self.pagination_class()
            page = paginator.paginate_queryset(queryset, request, view=self) # Truyền self vào view

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
            )


"""class ItemSearchAPI(APIView):
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
        return Response(serializer.data)"""
    
    
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
            sort_option = request.query_params.get('sort', 'newest')
            
            print(f"Items API - search: '{search}', sort: '{sort_option}'")
            
            # Base queryset
            queryset = Item.objects.all()
            print("Base queryset created successfully")
            
            try:
                queryset = queryset.annotate(num_bids=Count('bids'))  # Annotate with number of bids
                print("Successfully annotated num_bids")
            except Exception as e:
                print(f"Error annotating num_bids: {str(e)}")
                raise
            
            # Apply search filter if provided - use reliable LIKE query
            if search:
                try:
                    queryset = queryset.filter(
                        Q(name__icontains=search) | 
                        Q(description__icontains=search)
                    )
                    print("Successfully applied search filter")
                except Exception as e:
                    print(f"Error applying search filter: {str(e)}")
                    raise
                
                # Try to use simple full-text search for ranking only if needed
                if sort_option == 'relevance':
                    try:
                        config = 'Vietnamese_fts'
                        search_vector = (
                            SearchVector('name', weight='A', config=config) +
                            SearchVector('description', weight='B', config=config)
                        )
                        search_query = SearchQuery(search, config=config)
                        
                        queryset = queryset.annotate(
                            rank=SearchRank(search_vector, search_query)
                        ).order_by('-rank', '-num_bids')
                        print("Successfully applied full-text search ranking")
                    except Exception as e:
                        print(f"Full-text ranking failed: {str(e)}")
                        queryset = queryset.order_by('-item_id')  # Default fallback sort

            # Apply sorting (only if not already sorted by relevance)
            if not (search and sort_option == 'relevance'):
                try:
                    if sort_option == 'ending-soon':
                        queryset = queryset.filter(end_time__gt=timezone.now()).order_by('end_time', '-num_bids')
                    elif sort_option == 'price-low':
                        queryset = queryset.order_by('current_price', 'num_bids')
                    elif sort_option == 'price-high':
                        queryset = queryset.order_by('-current_price', '-num_bids')
                    elif sort_option == 'newest':
                        queryset = queryset.order_by('-item_id')
                    elif sort_option == 'most_bids':
                        queryset = queryset.order_by('-num_bids','-item_id')
                    elif sort_option == 'hottest':
                        try:
                            db_now = Now()
                            age_in_seconds_expr = ExpressionWrapper(
                                Extract(db_now - F('created_at'), 'epoch'), # Cho PostgreSQL
                                output_field=FloatField()
                            )
                            queryset = queryset.annotate(age_in__seconds_val= age_in_seconds_expr)
                            MIN_HOUR_FOR_RATE = 1
                            SECONDS_IN_HOUR = 3600.0
                            effective_hours_expr = Case(
                                When(Q(age_in_seconds_val__lt=MIN_HOUR_FOR_RATE * SECONDS_IN_HOUR) & Q(age_in_seconds_val__gt=0),
                                    then=Value(MIN_HOUR_FOR_RATE)),
                                When(Q(age_in_seconds_val__gte=MIN_HOUR_FOR_RATE * SECONDS_IN_HOUR),
                                     then=ExpressionWrapper(F('age_in_seconds_val') / SECONDS_IN_HOUR, output_field=FloatField())),
                                default = Value(MIN_HOUR_FOR_RATE),
                                output_field = FloatField()
                            )
                            hotness_score_expr = ExpressionWrapper(
                                F('num_bids') /effective_hours_expr,
                                output_field = FloatField()
                            )
                            queryset = queryset.annotate(
                                hotness_score=hotness_score_expr
                            ).order_by('-hotness_score', '-num_bids', '-created_at')
                            print("Successfully applied hottest sorting")
                        except Exception as e:
                            print(f"Error in hottest sorting: {str(e)}")
                            queryset = queryset.order_by('-item_id')  # Fallback to default sort
                    else: 
                        queryset = queryset.order_by('-num_bids','-item_id')
                    print("Successfully applied sorting")
                except Exception as e:
                    print(f"Error applying sorting: {str(e)}")
                    raise
            
            print(f"Items API queryset count: {queryset.count()}")
            
            # Apply pagination
            try:
                paginator = self.pagination_class()
                page = paginator.paginate_queryset(queryset, request)
                print("Successfully applied pagination")
            except Exception as e:
                print(f"Error applying pagination: {str(e)}")
                raise
            
            if page is not None:
                try:
                    serializer = ItemSerializer(page, many=True)
                    print("Successfully serialized paginated data")
                    return paginator.get_paginated_response(serializer.data)
                except Exception as e:
                    print(f"Error serializing paginated data: {str(e)}")
                    raise
            
            try:
                serializer = ItemSerializer(queryset, many=True)
                print("Successfully serialized all data")
                return Response(serializer.data)
            except Exception as e:
                print(f"Error serializing all data: {str(e)}")
                raise

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