"""ELO rating calculations and updates."""

from sqlalchemy.orm import Session, load_only

from app.db.models import Game, User, UserRating
from app.db.ordering import nulls_first_col
from app.utils.rating_pools import (
    get_rating_pool,
    get_user_rating,
    record_pool_result,
    set_user_rating,
)


class RatingService:
    K_FACTOR = 32

    def expected_score(self, rating_a: int, rating_b: int) -> float:
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

    def _apply_result(
        self,
        db: Session,
        game: Game,
        white: User,
        black: User,
        pool: str,
        result: str,
    ) -> None:
        white_rating = game.white_rating_before
        black_rating = game.black_rating_before

        if result == "white":
            white_score, black_score = 1.0, 0.0
        elif result == "black":
            white_score, black_score = 0.0, 1.0
        else:
            white_score, black_score = 0.5, 0.5

        white_expected = self.expected_score(white_rating, black_rating)
        black_expected = self.expected_score(black_rating, white_rating)

        white_delta = round(self.K_FACTOR * (white_score - white_expected))
        black_delta = round(self.K_FACTOR * (black_score - black_expected))

        set_user_rating(db, white, pool, white_rating + white_delta)
        set_user_rating(db, black, pool, black_rating + black_delta)
        record_pool_result(db, white, pool, result, is_white=True)
        record_pool_result(db, black, pool, result, is_white=False)

        game.white_rating_after = get_user_rating(db, white, pool)
        game.black_rating_after = get_user_rating(db, black, pool)
        game.rating_pool = pool

    def update_ratings(self, db: Session, game: Game, result: str) -> None:
        white = db.query(User).filter(User.id == game.white_user_id).one()
        black = db.query(User).filter(User.id == game.black_user_id).one()

        pool = game.rating_pool or get_rating_pool(game.time_control, game.game_mode)
        game.rating_pool = pool

        self._apply_result(db, game, white, black, pool, result)
        db.commit()

    def rebuild_all_ratings(self, db: Session) -> None:
        """Rebuild user_ratings from finished games (fixes mis-assigned pools)."""
        db.query(UserRating).delete(synchronize_session=False)
        db.query(User).update(
            {
                User.rating: 1500,
                User.games_played: 0,
                User.wins: 0,
                User.losses: 0,
                User.draws: 0,
            },
            synchronize_session=False,
        )
        db.flush()

        games = (
            db.query(Game)
            .options(
                load_only(
                    Game.id,
                    Game.white_user_id,
                    Game.black_user_id,
                    Game.time_control,
                    Game.game_mode,
                    Game.rating_pool,
                    Game.white_rating_before,
                    Game.black_rating_before,
                    Game.white_rating_after,
                    Game.black_rating_after,
                    Game.status,
                    Game.result,
                    Game.finished_at,
                    Game.created_at,
                )
            )
            .filter(Game.status == "finished", Game.result.isnot(None))
            .order_by(*nulls_first_col(Game.finished_at), Game.created_at.asc())
            .all()
        )

        for game in games:
            if game.time_control.startswith("royale/"):
                game.game_mode = "royale"
            else:
                game.game_mode = "standard"
            pool = get_rating_pool(game.time_control, game.game_mode)

            white = db.query(User).filter(User.id == game.white_user_id).one()
            black = db.query(User).filter(User.id == game.black_user_id).one()

            game.white_rating_before = get_user_rating(db, white, pool)
            game.black_rating_before = get_user_rating(db, black, pool)
            self._apply_result(db, game, white, black, pool, game.result)

        db.commit()


rating_service = RatingService()
