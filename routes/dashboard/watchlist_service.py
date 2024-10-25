from models import User, Watchlist, WatchlistItem, Instrument
from extensions import db, redis_client
from .utils import cache_key, get_cached_data, set_cached_data
import json
from sqlalchemy import and_, or_

class WatchlistService:
    def get_user_watchlists(self, user_id):
        """Get all watchlists for a user with their items"""
        try:
            watchlists = Watchlist.query.filter_by(user_id=user_id).all()
            watchlists_data = []

            for watchlist in watchlists:
                watchlist_items = WatchlistItem.query.filter_by(watchlist_id=watchlist.id).all()
                watchlist_dict = {
                    'id': watchlist.id,
                    'name': watchlist.name,
                    'items_list': [{
                        'id': item.id,
                        'symbol': item.symbol,
                        'name': item.name,
                        'token': item.token,
                        'expiry': item.expiry,
                        'strike': item.strike,
                        'lotsize': item.lotsize,
                        'instrumenttype': item.instrumenttype,
                        'exch_seg': item.exch_seg,
                        'tick_size': item.tick_size
                    } for item in watchlist_items]
                }
                watchlists_data.append(watchlist_dict)

            # Update Redis cache
            redis_key = cache_key('user', f'{user_id}:watchlists')
            set_cached_data(redis_key, watchlists_data)
            
            return watchlists_data
            
        except Exception as e:
            print(f"Error fetching watchlists: {str(e)}")
            return []

    def create_watchlist(self, user_id, name):
        """Create a new watchlist"""
        if not name:
            return {'error': 'Watchlist name is required', 'code': 400}

        try:
            # Check watchlist limit
            if not self._validate_watchlist_limit(user_id):
                return {'error': 'Maximum 5 watchlists allowed', 'code': 400}

            new_watchlist = Watchlist(name=name, user_id=user_id)
            db.session.add(new_watchlist)
            db.session.commit()

            watchlist_data = {
                'id': new_watchlist.id,
                'name': new_watchlist.name,
                'items': []
            }

            self._update_redis_cache(user_id)
            
            return {
                'watchlist_id': new_watchlist.id,
                'data': watchlist_data
            }

        except Exception as e:
            db.session.rollback()
            return {'error': str(e), 'code': 500}

    def update_watchlist(self, user_id, watchlist_id, new_name):
        """Update watchlist name"""
        if not new_name:
            return {'error': 'Watchlist name is required', 'code': 400}

        try:
            watchlist = self._get_user_watchlist(user_id, watchlist_id)
            if not watchlist:
                return {'error': 'Watchlist not found', 'code': 404}

            watchlist.name = new_name
            db.session.commit()
            self._update_redis_cache(user_id)
            
            return {'status': 'success'}

        except Exception as e:
            db.session.rollback()
            return {'error': str(e), 'code': 500}

    def add_watchlist_item(self, user_id, watchlist_id, symbol, exch_seg):
        """Add item to watchlist"""
        try:
            # Validate watchlist
            watchlist = self._get_user_watchlist(user_id, watchlist_id)
            if not watchlist:
                return {'error': 'Watchlist not found', 'code': 404}

            # Check if item exists
            if self._item_exists(watchlist_id, symbol, exch_seg):
                return {'error': 'Item already exists in watchlist', 'code': 400}

            # Get instrument details
            instrument = Instrument.query.filter_by(
                symbol=symbol,
                exch_seg=exch_seg
            ).first()
            
            if not instrument:
                return {'error': 'Invalid symbol or exchange', 'code': 404}

            # Create new watchlist item
            new_item = WatchlistItem(
                watchlist_id=watchlist_id,
                symbol=instrument.symbol,
                name=instrument.name,
                token=instrument.token,
                expiry=instrument.expiry,
                strike=instrument.strike,
                lotsize=instrument.lotsize,
                instrumenttype=instrument.instrumenttype,
                exch_seg=instrument.exch_seg,
                tick_size=instrument.tick_size
            )
            
            db.session.add(new_item)
            db.session.commit()
            self._update_redis_cache(user_id)

            return {
                'data': {
                    'id': new_item.id,
                    'symbol': new_item.symbol,
                    'name': new_item.name,
                    'token': new_item.token,
                    'expiry': new_item.expiry,
                    'strike': new_item.strike,
                    'lotsize': new_item.lotsize,
                    'instrumenttype': new_item.instrumenttype,
                    'exch_seg': new_item.exch_seg,
                    'tick_size': new_item.tick_size
                }
            }

        except Exception as e:
            db.session.rollback()
            return {'error': str(e), 'code': 500}
        
    def delete_watchlist(self, user_id, watchlist_id):
        """Delete a watchlist and all its items"""
        try:
            # Get the watchlist and verify ownership
            watchlist = self._get_user_watchlist(user_id, watchlist_id)
            if not watchlist:
                return {'error': 'Watchlist not found', 'code': 404}

            # Delete all items in the watchlist first (cascade should handle this, but being explicit)
            WatchlistItem.query.filter_by(watchlist_id=watchlist_id).delete()
            
            # Delete the watchlist
            db.session.delete(watchlist)
            db.session.commit()

            # Update Redis cache
            redis_key = f'user:{user_id}:watchlists'
            watchlists_data = get_cached_data(redis_key, [])
            updated_data = [w for w in watchlists_data if w['id'] != watchlist_id]
            set_cached_data(redis_key, updated_data)

            return {'status': 'success', 'watchlist_id': watchlist_id}

        except Exception as e:
            db.session.rollback()
            return {'error': str(e), 'code': 500}

    def remove_watchlist_item(self, user_id, item_id):
        """Remove item from watchlist"""
        try:
            item = WatchlistItem.query.join(Watchlist).filter(
                WatchlistItem.id == item_id,
                Watchlist.user_id == user_id
            ).first()

            if not item:
                return {'error': 'Item not found', 'code': 404}

            db.session.delete(item)
            db.session.commit()
            self._update_redis_cache(user_id)
            
            return {'status': 'success'}

        except Exception as e:
            db.session.rollback()
            return {'error': str(e), 'code': 500}

    def search_symbols(self, query):
        """Search for symbols"""
        try:
            # Split the query into individual terms
            terms = query.upper().split()
            
            # Create a list of conditions for each term
            conditions = []
            for term in terms:
                term_condition = or_(
                    Instrument.symbol.ilike(f'%{term}%'),
                    Instrument.name.ilike(f'%{term}%'),
                    Instrument.exch_seg.ilike(f'%{term}%'),
                    Instrument.instrumenttype.ilike(f'%{term}%'),
                    Instrument.expiry.ilike(f'%{term}%'),
                    Instrument.strike.ilike(f'%{term}%')
                )
                conditions.append(term_condition)
            
            # Combine all conditions with AND
            combined_condition = and_(*conditions)
            
            # Query the database
            instruments = Instrument.query.filter(combined_condition).limit(10).all()

            return [{
                'symbol': instrument.symbol,
                'name': instrument.name,
                'exch_seg': instrument.exch_seg,
                'token': instrument.token,
                'instrumenttype': instrument.instrumenttype,
                'expiry': instrument.expiry,
                'strike': instrument.strike
            } for instrument in instruments]

        except Exception as e:
            print(f"Error searching symbols: {str(e)}")
            return []

    def _validate_watchlist_limit(self, user_id):
        """Check if user can create more watchlists"""
        count = Watchlist.query.filter_by(user_id=user_id).count()
        return count < 5

    def _get_user_watchlist(self, user_id, watchlist_id):
        """Get watchlist if it belongs to user"""
        return Watchlist.query.filter_by(
            id=watchlist_id,
            user_id=user_id
        ).first()

    def _item_exists(self, watchlist_id, symbol, exch_seg):
        """Check if item exists in watchlist"""
        return WatchlistItem.query.filter_by(
            watchlist_id=watchlist_id,
            symbol=symbol,
            exch_seg=exch_seg
        ).first() is not None

    def _update_redis_cache(self, user_id):
        """Update Redis cache with fresh watchlist data"""
        watchlists = self.get_user_watchlists(user_id)
        redis_key = cache_key('user', f'{user_id}:watchlists')
        set_cached_data(redis_key, watchlists)
